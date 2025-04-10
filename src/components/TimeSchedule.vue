<template>
  
  <div class="time-schedule">
    <!-- 视图切换按钮 -->
    <div class="view-controls">
      <button 
        v-for="view in ['day', 'threeDay', 'week']" 
        :key="view"
        :class="{ active: currentView === view }"
        @click="setView(view)"
      >
        {{ viewLabels[view] }}
      </button>
    </div>

    <!-- 日期表头 -->
    <div class="date-headers">
      <div class="time-slot-header"></div>
      <div 
        v-for="date in viewDates" 
        :key="date.format()" 
        class="date-header"
        :class="{ 
          'day-view-header': currentView === 'day',
          'three-day-view-header': currentView === 'threeDay'
        }"
      >
        {{ date.format('MM/DD ddd') }}
      </div>
    </div>

    <!-- 时间轴 -->
    <div 
      class="timeline-container"
      :class="{ 
        'day-view-container': currentView === 'day',
        'three-day-view-container': currentView === 'threeDay'
      }"
      ref="timelineContainer"
    >
      <!-- 时间刻度 -->
      <div class="time-scale">
        <div 
          v-for="hour in 24" 
          :key="hour" 
          class="time-hour"
          :style="{ top: `${hour * 60 * timeScale}px` }"
        >
          {{ (hour).toString().padStart(2, '0') }}:00
        </div>
        
        <template v-for="hour in 24" :key="`min-${hour}`">
          <div 
            class="time-minute"
            :style="{ top: `${((hour - 1) * 60 + 30) * timeScale}px` }"
          >
            {{ (hour - 1).toString().padStart(2, '0') }}:30
          </div>
        </template>
      </div>

      <!-- 时间格子区域 -->
      <div 
        class="timeline-grid"
        @click="onTimelineClick"
        @dragover.prevent="onDragOver"
        @drop="onDrop"
      >
        <!-- 每列代表一天 -->
        <div 
          v-for="(date, dateIndex) in viewDates" 
          :key="date.format()" 
          class="date-column"
          :class="{ 
            'day-view-column': currentView === 'day',
            'three-day-view-column': currentView === 'threeDay'
          }"
          :data-date="date.format('YYYY-MM-DD')"
        >
          <!-- 每个小时的网格线 -->
          <div 
            v-for="hour in 25" 
            :key="`grid-${hour}`" 
            class="hour-grid"
            :style="{ top: `${hour * 60 * timeScale}px` }"
          ></div>

          <!-- 任务块 -->
          <div 
            v-for="task in getTasksForDate(date)"
            :key="task.id"
            class="task-block"
            :class="{ completed: task.completed }"
            :style="getTaskStyle(task)"
            @click.stop="taskClick($event, task)"
            @dblclick="toggleTaskCompletion(task)"
            draggable="true"
            @dragstart="onTaskDragStart($event, task)"
          >
            <div 
              class="resize-handle-top" 
              @mousedown.stop="startResizing($event, task, 'top')"
            ></div>
            <div 
              class="task-content" 
              :class="{ 
                'standard-mode': !isCompactTask(task) && !isVerySmallTask(task),
                'compact-mode': isCompactTask(task) && !isVerySmallTask(task),
                'very-small-mode': isVerySmallTask(task)
              }"
            >
              <span class="task-name">{{ task.name }}</span>
              <span 
                v-if="!isVerySmallTask(task)" 
                class="task-time"
              >{{ task.startTime }} - {{ task.endTime }}</span>
            </div>
            <div 
              class="resize-handle-bottom" 
              @mousedown.stop="startResizing($event, task, 'bottom')"
            ></div>
          </div>
        </div>
      </div>
    </div>

    <!-- 浮窗表单 -->
    <div 
      v-if="showTaskForm" 
      class="task-form"
      :style="{ top: `${formPosition.y}px`, left: `${formPosition.x}px` }"
    >
      <div class="form-header">
        <h3>{{ editingTask.id ? '编辑待办' : '新建待办' }}</h3>
      </div>
      <div class="form-body">
        <div class="form-group">
          <label>待办名称:</label>
          <input type="text" v-model="editingTask.name" placeholder="请输入待办名称" />
        </div>
        <div class="form-group">
          <label>开始时间:</label>
          <input type="time" v-model="editingTask.startTime" />
        </div>
        <div class="form-group">
          <label>结束时间:</label>
          <input type="time" v-model="editingTask.endTime" />
        </div>
      </div>
      <div class="form-footer">
        <button @click="cancelTaskForm">取消</button>
        <button @click="saveTask" class="primary">确定</button>
      </div>
    </div>

    <!-- 任务浮窗菜单 -->
    <div 
      v-if="showTaskMenu" 
      class="task-menu"
      :style="{ top: `${taskMenuPosition.y}px`, left: `${taskMenuPosition.x}px` }"
    >
      <div @click="completeSelectedTask" class="menu-item">{{ selectedTask && selectedTask.completed ? '取消完成' : '完成' }}</div>
      <div @click="editSelectedTask" class="menu-item">编辑</div>
      <div @click="deleteSelectedTask" class="menu-item delete">删除</div>
    </div>
  </div>
</template>

<script>
import dayjs from 'dayjs';

export default {
  name: 'TimeSchedule',
  props: {
    todos: {
      type: Array,
      required: true
    }
  },
  data() {
    return {
      currentView: 'day',
      viewLabels: {
        day: '每日',
        threeDay: '三日',
        week: '一周'
      },
      timeScale: 1, // 默认每分钟对应1像素
      showTaskForm: false,
      showTaskMenu: false,
      showContextMenu: false,
      formPosition: { x: 0, y: 0 },
      taskMenuPosition: { x: 0, y: 0 },
      contextMenuPosition: { x: 0, y: 0 },
      editingTask: {
        id: null,
        name: '',
        date: '',
        startTime: '',
        endTime: '',
        completed: false
      },
      selectedTask: null,
      resizing: {
        active: false,
        task: null,
        edge: null, // 'top' or 'bottom'
        initialY: 0,
        initialTime: ''
      },
      heightObserver: null
    };
  },
  computed: {
    viewDates() {
      const today = dayjs();
      const dates = [];
      
      if (this.currentView === 'day') {
        dates.push(today);
      } else if (this.currentView === 'threeDay') {
        for (let i = 0; i < 3; i++) {
          dates.push(today.add(i, 'day'));
        }
      } else if (this.currentView === 'week') {
        for (let i = 0; i < 7; i++) {
          dates.push(today.add(i, 'day'));
        }
      }
      
      return dates;
    }
  },
  mounted() {
    // 全局事件监听
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.stopResizing);
    window.addEventListener('click', this.closeMenus);
    window.addEventListener('resize', this.onWindowResize);
    
    // 初始设置时间单位比例和同步高度
    this.calculateTimeScale();
    this.syncPanelHeight();
    
    // 初始化滚动位置
    this.$nextTick(() => {
      this.scrollToWorkingHours();
    });
    
    // 创建MutationObserver监听DOM变化，确保高度同步
    this.setupHeightObserver();
  },
  beforeUnmount() {
    // 清除全局事件监听
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.stopResizing);
    window.removeEventListener('click', this.closeMenus);
    window.removeEventListener('resize', this.onWindowResize);
    
    // 清除高度观察器
    if (this.heightObserver) {
      this.heightObserver.disconnect();
    }
  },
  methods: {
    setView(view) {
      this.currentView = view;
      this.$nextTick(() => {
        this.calculateTimeScale();
        this.syncPanelHeight();
      });
    },
    
    calculateTimeScale() {
      // 保持固定的1像素/分钟比例
      this.$nextTick(() => {
        this.timeScale = 1;
        this.syncPanelHeight();
      });
    },
    
    getTasksForDate(date) {
      // 过滤出当天的任务
      const dateStr = date.format('YYYY-MM-DD');
      return this.todos.filter(task => {
        // 只显示有日期且日期匹配的任务
        return task.date === dateStr && task.startTime && task.endTime;
      });
    },
    
    getTaskStyle(task) {
      if (!task.startTime || !task.endTime) return {};
      
      // 解析时间
      const [startHour, startMinute] = task.startTime.split(':').map(Number);
      const [endHour, endMinute] = task.endTime.split(':').map(Number);
      
      // 计算对应的像素位置
      const startMinutes = startHour * 60 + startMinute;
      const endMinutes = endHour * 60 + endMinute;
      const top = startMinutes * this.timeScale;
      const height = (endMinutes - startMinutes) * this.timeScale;
      
      return {
        top: `${top}px`,
        height: `${height}px`
      };
    },
    
    // 判断任务是否应该使用紧凑显示模式
    isCompactTask(task) {
      if (!task.startTime || !task.endTime) return false;
      
      // 解析时间
      const [startHour, startMinute] = task.startTime.split(':').map(Number);
      const [endHour, endMinute] = task.endTime.split(':').map(Number);
      
      // 计算任务持续时间（分钟）
      const startMinutes = startHour * 60 + startMinute;
      const endMinutes = endHour * 60 + endMinute;
      const durationMinutes = endMinutes - startMinutes;
      
      // 当持续时间小于40分钟时使用紧凑模式
      return durationMinutes < 40;
    },
    
    // 判断任务是否超小(仅用于显示优化)
    isVerySmallTask(task) {
      if (!task.startTime || !task.endTime) return false;
      
      // 解析时间
      const [startHour, startMinute] = task.startTime.split(':').map(Number);
      const [endHour, endMinute] = task.endTime.split(':').map(Number);
      
      // 计算任务持续时间（分钟）
      const startMinutes = startHour * 60 + startMinute;
      const endMinutes = endHour * 60 + endMinute;
      const durationMinutes = endMinutes - startMinutes;
      
      // 当持续时间小于18分钟时认为是超小任务
      return durationMinutes < 18;
    },
    
    onTimelineClick(event) {
      // 如果是右键点击不处理
      if (event.button === 2) return;
      
      // 阻止冒泡，防止点击到已有任务的区域
      if (event.target.classList.contains('task-block') || 
          event.target.closest('.task-block')) {
        return;
      }
      
      // 关闭任何打开的菜单
      this.showTaskMenu = false;
      
      // 计算点击位置对应的时间
      const rect = this.getTimelineRect();
      const y = event.clientY - rect.top + this.$refs.timelineContainer.scrollTop;
      const dateColumn = event.target.closest('.date-column');
      
      if (!dateColumn) return;
      
      const dateStr = dateColumn.dataset.date;
      const minutes = Math.floor(y / this.timeScale);
      
      // 将分钟对齐到最近的5分钟
      const alignedMinutes = Math.round(minutes / 5) * 5;
      
      // 确保时间不超过24小时
      if (alignedMinutes >= 24 * 60) {
        return; // 超出范围，不处理
      }
      
      const hour = Math.floor(alignedMinutes / 60);
      const minute = alignedMinutes % 60;
      
      // 设置开始时间和默认的30分钟结束时间
      const startTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      
      // 计算默认结束时间（开始时间 + 30分钟）
      let endMinutes = alignedMinutes + 30;
      let endHour, endMinute;
      
      // 确保结束时间不超过24小时
      if (endMinutes >= 24 * 60) {
        endMinutes = 24 * 60 - 1; // 设置为23:59
      }
      
      endHour = Math.floor(endMinutes / 60);
      endMinute = endMinutes % 60;
      
      const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
      
      // 直接创建待办事项
      this.$emit('add-task', {
        id: Date.now(),
        name: '新待办',
        date: dateStr,
        startTime,
        endTime,
        completed: false,
        completedAt: null
      });
    },
    
    getTimelineRect() {
      const timeline = this.$refs.timelineContainer;
      return timeline.getBoundingClientRect();
    },
    
    openTaskForm(event, task) {
      this.editingTask = { ...task };
      this.formPosition = {
        x: event.clientX,
        y: event.clientY
      };
      this.showTaskForm = true;
      this.showTaskMenu = false;
    },
    
    saveTask() {
      if (!this.editingTask.name.trim()) {
        this.editingTask.name = '新待办';
      }
      
      // 如果未输入起止时间，则取消操作
      if (this.editingTask.id && (!this.editingTask.startTime || !this.editingTask.endTime)) {
        this.showTaskForm = false;
        return;
      }
      
      if (this.editingTask.id) {
        // 编辑已有任务
        this.$emit('update-task', this.editingTask);
      } else {
        // 创建新任务
        this.$emit('add-task', {
          ...this.editingTask,
          id: Date.now(),
          completedAt: null
        });
      }
      
      this.showTaskForm = false;
    },
    
    cancelTaskForm() {
      this.showTaskForm = false;
    },
    
    toggleTaskCompletion(task) {
      this.$emit('complete-task', task);
    },
    
    closeMenus(event) {
      // 如果点击是在任务菜单之外的地方，则关闭菜单
      if (this.showTaskMenu && !event.target.closest('.task-menu')) {
        this.showTaskMenu = false;
      }
      
      // 如果点击是在上下文菜单之外的地方，则关闭菜单
      if (this.showContextMenu && !event.target.closest('.context-menu')) {
        this.showContextMenu = false;
      }
    },
    
    // 任务点击处理 - 显示任务菜单
    taskClick(event, task) {
      // 如果是拉伸区域的点击，不处理
      if (event.target.classList.contains('resize-handle-top') || 
          event.target.classList.contains('resize-handle-bottom')) {
        return;
      }
      
      // 设置选中的任务并显示任务操作菜单
      this.selectedTask = task;
      this.taskMenuPosition = {
        x: event.clientX,
        y: event.clientY
      };
      this.showTaskMenu = true;
      event.stopPropagation(); // 阻止冒泡，防止触发时间轴点击
    },
    
    // 完成选中的任务
    completeSelectedTask() {
      if (this.selectedTask) {
        this.toggleTaskCompletion(this.selectedTask);
        this.showTaskMenu = false;
      }
    },
    
    // 编辑选中的任务
    editSelectedTask() {
      if (this.selectedTask) {
        this.openTaskForm({ 
          clientX: this.taskMenuPosition.x, 
          clientY: this.taskMenuPosition.y 
        }, this.selectedTask);
      }
    },
    
    // 删除选中的任务
    deleteSelectedTask() {
      if (this.selectedTask) {
        this.$emit('delete-task', this.selectedTask);
        this.showTaskMenu = false;
      }
    },
    
    startResizing(event, task, edge) {
      // 保存当前任务和调整方向
      this.resizing = {
        active: true,
        task: { ...task },
        edge: edge,
        initialY: event.clientY,
        initialTime: edge === 'top' ? task.startTime : task.endTime
      };
      event.preventDefault(); // 防止触发拖拽
      event.stopPropagation(); // 阻止冒泡
    },
    
    onMouseMove(event) {
      if (!this.resizing.active) return;
      
      const deltaY = event.clientY - this.resizing.initialY;
      // 注意这里的方向问题：
      // 对于顶部拉伸，向上拖动时deltaY为负值，此时应该减少startTime
      // 对于底部拉伸，向下拖动时deltaY为正值，此时应该增加endTime
      let deltaMinutes = Math.round((deltaY / this.timeScale) / 5) * 5; // 对齐到5分钟
      
      if (this.resizing.edge === 'top') {
        // 调整开始时间 - 修复上拉逻辑，向上拖动时deltaY为负，要减小startTime值
        const [hours, minutes] = this.resizing.initialTime.split(':').map(Number);
        let totalMinutes = hours * 60 + minutes + deltaMinutes; // 注意这里是加号，因为向上拖动时要减小时间
        
        // 确保不小于0且小于结束时间
        const [endHours, endMinutes] = this.resizing.task.endTime.split(':').map(Number);
        const endTotalMinutes = endHours * 60 + endMinutes;
        
        // 确保与结束时间的间隔至少为5分钟
        totalMinutes = Math.max(0, Math.min(totalMinutes, endTotalMinutes - 5));
        
        const newHours = Math.floor(totalMinutes / 60);
        const newMinutes = totalMinutes % 60;
        
        const startTime = `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
        
        this.$emit('update-task-time', {
          ...this.resizing.task,
          startTime
        });
      } else if (this.resizing.edge === 'bottom') {
        // 调整结束时间
        const [hours, minutes] = this.resizing.initialTime.split(':').map(Number);
        let totalMinutes = hours * 60 + minutes + deltaMinutes;
        
        // 确保不大于24小时且大于开始时间
        const [startHours, startMinutes] = this.resizing.task.startTime.split(':').map(Number);
        const startTotalMinutes = startHours * 60 + startMinutes;
        
        // 确保与开始时间的间隔至少为5分钟
        totalMinutes = Math.min(24 * 60 - 1, Math.max(totalMinutes, startTotalMinutes + 5));
        
        const newHours = Math.floor(totalMinutes / 60);
        const newMinutes = totalMinutes % 60;
        
        const endTime = `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
        
        this.$emit('update-task-time', {
          ...this.resizing.task,
          endTime
        });
      }
    },
    
    stopResizing() {
      this.resizing.active = false;
    },
    
    onDragOver(event) {
      // 阻止默认行为，允许放置
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    },
    
    onTaskDragStart(event, task) {
      // 只有在非调整大小的情况下才允许拖拽
      if (this.resizing.active) {
        event.preventDefault();
        return;
      }
      
      // 关闭任何打开的菜单
      this.showTaskMenu = false;
      
      // 保存任务ID和任务信息用于拖拽
      event.dataTransfer.setData('taskId', task.id.toString());
      event.dataTransfer.setData('taskData', JSON.stringify(task));
      // 设置拖拽效果
      event.dataTransfer.effectAllowed = 'move';
    },
    
    onDrop(event) {
      // 阻止默认行为
      event.preventDefault();
      
      const taskId = event.dataTransfer.getData('taskId');
      if (!taskId) return;
      
      // 计算放置位置对应的时间
      const rect = this.getTimelineRect();
      const y = event.clientY - rect.top + this.$refs.timelineContainer.scrollTop;
      const dateColumn = event.target.closest('.date-column');
      
      if (!dateColumn) return;
      
      const dateStr = dateColumn.dataset.date;
      const minutes = Math.floor(y / this.timeScale);
      
      // 将分钟对齐到最近的5分钟（最大值为24小时 - 任务时长）
      const alignedMinutes = Math.max(0, Math.min(Math.round(minutes / 5) * 5, 24 * 60 - 5));
      
      const hour = Math.floor(alignedMinutes / 60);
      const minute = alignedMinutes % 60;
      
      // 设置开始时间
      const startTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      
      // 查找被拖拽的任务
      const task = this.todos.find(t => t.id.toString() === taskId);
      if (task) {
        // 计算当前任务的持续时间（分钟）
        let durationMinutes = 30; // 默认30分钟
        
        if (task.startTime && task.endTime) {
          const [taskStartHour, taskStartMinute] = task.startTime.split(':').map(Number);
          const [taskEndHour, taskEndMinute] = task.endTime.split(':').map(Number);
          durationMinutes = (taskEndHour * 60 + taskEndMinute) - (taskStartHour * 60 + taskStartMinute);
        }
        
        // 计算新结束时间（保持持续时间不变）
        let newEndMinutes = alignedMinutes + durationMinutes;
        
        // 检查结束时间是否超出24小时
        if (newEndMinutes >= 24 * 60) {
          // 如果超出范围，调整持续时间
          newEndMinutes = 24 * 60 - 1; // 限制到23:59
        }
        
        const newEndHour = Math.floor(newEndMinutes / 60);
        const newEndMinute = newEndMinutes % 60;
        const endTime = `${newEndHour.toString().padStart(2, '0')}:${newEndMinute.toString().padStart(2, '0')}`;
        
        // 更新任务的时间信息
        this.$emit('schedule-task', {
          ...task,
          date: dateStr,
          startTime,
          endTime
        });
      }
    },
    
    // 窗口大小变化处理
    onWindowResize() {
      this.calculateTimeScale();
      // 同步高度
      this.syncPanelHeight();
      // 保持当前滚动位置的时间点不变
      this.maintainScrollPosition();
    },
    
    // 维持滚动位置（基于当前可见区域的中心时间点）
    maintainScrollPosition() {
      if (!this.$refs.timelineContainer) return;
      
      const container = this.$refs.timelineContainer;
      const containerHeight = container.clientHeight;
      const scrollTop = container.scrollTop;
      
      // 计算当前可见区域中心对应的时间（分钟）
      const centerMinutes = Math.floor((scrollTop + containerHeight / 2) / this.timeScale);
      
      // 计算新的滚动位置，使同一时间点位于中心
      this.$nextTick(() => {
        const newScrollTop = centerMinutes * this.timeScale - containerHeight / 2;
        container.scrollTop = Math.max(0, newScrollTop);
      });
    },
    
    // 滚动到工作时间（默认9点钟）
    scrollToWorkingHours() {
      if (!this.$refs.timelineContainer) return;
      
      // 滚动到上午9点的位置
      const workingHourMinutes = 9 * 60; // 9:00 AM
      const scrollTop = workingHourMinutes * this.timeScale - 50; // 减去一些偏移，让9点位于视图上方
      
      this.$refs.timelineContainer.scrollTop = Math.max(0, scrollTop);
    },
    
    // 设置高度观察器
    setupHeightObserver() {
      // 获取左侧面板
      const leftPanel = document.querySelector('.left-panel');
      
      if (!leftPanel) {
        console.warn('左侧面板未找到，无法设置高度观察器');
        return;
      }
      
      // 创建MutationObserver实例
      this.heightObserver = new MutationObserver(() => {
        // 左侧面板高度变化时，同步右侧面板高度
        this.syncPanelHeight();
      });
      
      // 配置观察选项
      const config = {
        attributes: true,  // 观察属性变化
        childList: true,   // 观察子节点变化
        subtree: true,     // 观察所有后代节点
        attributeFilter: ['style', 'class'] // 只观察可能影响高度的属性
      };
      
      // 开始观察
      this.heightObserver.observe(leftPanel, config);
      
      // 添加事件监听器以响应任务添加/删除/完成等操作
      document.addEventListener('taskUpdated', this.syncPanelHeight);
    },
    
    // 同步面板高度
    syncPanelHeight() {
      if (!this.$refs.timelineContainer) return;
      
      const container = this.$refs.timelineContainer;
      
      // 获取左侧面板高度
      let leftPanelHeight = 0;
      const leftPanel = document.querySelector('.left-panel');
      if (leftPanel) {
        leftPanelHeight = leftPanel.clientHeight;
      }
      
      // 确保时间轴容器高度与左侧面板高度一致
      const timelineHeight = 24 * 60 * this.timeScale;
      
      // 设置容器的最小高度为左侧面板高度（减去padding和其他UI元素的高度）
      const uiElementsHeight = 80; // 估计值，包括标题和按钮等高度
      const availableHeight = Math.max(leftPanelHeight - uiElementsHeight, 400);
      
      container.style.minHeight = `${availableHeight}px`;
      container.style.maxHeight = `${availableHeight}px`;
      
      // 确保内容高度足够显示完整时间轴
      const innerContent = container.querySelector('.timeline-grid');
      if (innerContent) {
        innerContent.style.minHeight = `${timelineHeight}px`;
      }
    },
  }
}
</script>

<style scoped>
.time-schedule {
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
}

.view-controls {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}

.view-controls button {
  padding: 6px 12px;
  border: 1px solid #ddd;
  background: #f5f5f5;
  cursor: pointer;
  border-radius: 4px;
}

.view-controls button.active {
  background: #007bff;
  color: white;
  border-color: #0069d9;
}

.date-headers {
  display: flex;
  border-bottom: 1px solid #ddd;
  width: 100%;
}

.time-slot-header {
  width: 60px;
  flex-shrink: 0;
}

.date-header {
  flex: 1;
  padding: 10px;
  text-align: center;
  font-weight: bold;
  border-left: 1px solid #eee;
}

/* 日视图下的表头宽度固定 */
.date-header.day-view-header {
  flex: 0 0 300px;
  width: 300px;
}

/* 三日视图下的表头宽度固定 */
.date-header.three-day-view-header {
  flex: 0 0 180px;
  width: 180px;
}

.timeline-container {
  flex: 1;
  overflow-y: auto;
  position: relative;
  display: flex;
  /* 时间轴容器高度将由JS动态设置 */
  min-height: 400px;
  height: auto;
}

/* 确保时间轴的滚动条显示正常 */
.timeline-container::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.timeline-container::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.timeline-container::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 4px;
}

.timeline-container::-webkit-scrollbar-thumb:hover {
  background: #555;
}

/* 添加水平滚动支持 */
.timeline-container.day-view-container {
  overflow-x: auto;
}

/* 三日视图的水平滚动支持 */
.timeline-container.three-day-view-container {
  overflow-x: auto;
}

.time-scale {
  width: 60px;
  flex-shrink: 0;
  position: relative;
  background: #f9f9f9;
  border-right: 1px solid #ddd;
  height: 100%;
}

.time-hour {
  position: absolute;
  width: 100%;
  padding-right: 5px;
  text-align: right;
  border-top: 1px solid #ddd;
  font-size: 12px;
  height: 16px;
  line-height: 0;
  user-select: none;
}

.time-minute {
  position: absolute;
  width: 100%;
  padding-right: 5px;
  text-align: right;
  border-top: 1px dashed #eee;
  font-size: 8px;
  color: #999;
  height: 10px;
  line-height: 0;
  user-select: none;
  opacity: 0.7;
}

.timeline-grid {
  flex: 1;
  position: relative;
  display: flex;
  height: 100%;
}

.date-column {
  flex: 1;
  position: relative;
  border-left: 1px solid #eee;
  height: 100%;
}

/* 日视图下的列宽度固定 */
.date-column.day-view-column {
  flex: 0 0 300px;
  width: 300px;
}

/* 三日视图下的列宽度固定 */
.date-column.three-day-view-column {
  flex: 0 0 180px;
  width: 180px;
}

.hour-grid {
  position: absolute;
  left: 0;
  right: 0;
  border-top: 1px solid #eee;
}

.task-block {
  position: absolute;
  left: 2px;
  right: 2px;
  background-color: #4CAF50;
  color: white;
  border-radius: 3px;
  padding: 2px 4px;
  font-size: 11px;
  overflow: hidden;
  cursor: move;
  user-select: none;
  z-index: 10;
  min-height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.8);
  box-shadow: 0 0 5px rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
}

.task-block .resize-handle-top {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 6px;
  cursor: ns-resize;
}

.task-block .resize-handle-bottom {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 6px;
  cursor: ns-resize;
}

.task-block.completed {
  background-color: #9E9E9E;
  border-color: rgba(240, 240, 240, 0.8);
}

.task-block:hover {
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.5);
  border-color: rgba(255, 255, 255, 1);
}

.task-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 2px 0;
  justify-content: center;
  width: 100%;
}

/* 标准模式下的任务内容 - 持续时间≥40分钟 */
.task-content.standard-mode {
  flex-direction: column;
  justify-content: center;
  padding: 2px 4px;
}

/* 紧凑模式下的任务内容 - 持续时间<40分钟 */
.task-content.compact-mode {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px;
}

.task-name {
  font-weight: bold;
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 标准模式下的任务名称 */
.task-content.standard-mode .task-name {
  font-size: 11px;
  margin-bottom: 3px;
}

/* 紧凑模式下的任务名称 */
.task-content.compact-mode .task-name {
  margin-bottom: 0;
  font-size: 10px;
  max-width: 65%;
  flex-shrink: 1;
}

.task-time {
  font-size: 10px;
  opacity: 0.8;
  white-space: nowrap;
}

/* 标准模式下的时间显示 */
.task-content.standard-mode .task-time {
  font-size: 10px;
}

/* 紧凑模式下的时间显示 */
.task-content.compact-mode .task-time {
  font-size: 9px;
  margin-left: 4px;
  flex-shrink: 0;
}

/* 添加不同优先级/类型的视觉区分 */
.task-block[data-priority="high"] {
  background-color: #F44336;
  border-color: rgba(255, 220, 220, 0.8);
}

.task-block[data-priority="medium"] {
  background-color: #FF9800;
  border-color: rgba(255, 235, 210, 0.8);
}

.task-block[data-priority="low"] {
  background-color: #8BC34A;
  border-color: rgba(230, 255, 220, 0.8);
}

/* 添加任务类型的视觉指示 */
.task-block::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background-color: rgba(0, 0, 0, 0.2);
}

.task-block.completed::before {
  background-color: rgba(150, 150, 150, 0.4);
}

.task-form {
  position: fixed;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 10px;
  width: 250px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  z-index: 1000;
}

.form-header {
  border-bottom: 1px solid #eee;
  margin-bottom: 10px;
}

.form-header h3 {
  margin: 0;
  padding: 0 0 10px 0;
}

.form-group {
  margin-bottom: 10px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
}

.form-group input {
  width: 100%;
  padding: 6px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.form-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 10px;
}

.form-footer button {
  padding: 6px 12px;
  border: 1px solid #ddd;
  background: #f5f5f5;
  cursor: pointer;
  border-radius: 4px;
}

.form-footer button.primary {
  background: #4CAF50;
  color: white;
  border-color: #43A047;
}

.task-menu {
  position: fixed;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  overflow: hidden;
}

.menu-item {
  padding: 8px 15px;
  cursor: pointer;
}

.menu-item:hover {
  background: #f5f5f5;
}

.menu-item.delete {
  color: #f44336;
}

/* 超小模式下的任务内容 */
.task-content.very-small-mode {
  padding: 0;
  justify-content: center;
  align-items: center;
  overflow: hidden;
}

/* 超小模式下的任务名称 */
.task-content.very-small-mode .task-name {
  font-size: 9px;
  margin: 0;
  padding: 0;
  line-height: 1;
  text-align: center;
  max-width: 100%;
}
</style> 