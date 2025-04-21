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
          'three-day-view-header': currentView === 'threeDay',
          'week-view-header': currentView === 'week',
          'today-column': date.format('YYYY-MM-DD') === todayDateString
        }"
      >
        <div>{{ date.format('MM/DD') }}</div>
        <div>{{ date.format('ddd') }}</div>
      </div>
    </div>

    <!-- 时间轴 -->
    <div 
      class="timeline-container"
      :class="{ 
        'day-view-container': currentView === 'day',
        'three-day-view-container': currentView === 'threeDay',
        'week-view-container': currentView === 'week'
      }"
      ref="timelineContainer"
      @mousemove="handleTimelineMouseMove"
      @mouseleave="hideHoverTimeLine"
    >
      <!-- 当前时间线 -->
      <div 
        class="current-time-line"
        v-if="currentView !== 'day' || viewDates[0].format('YYYY-MM-DD') === todayDateString"
        :style="{ top: `${currentTimePosition}px` }"
      >
        <span class="current-time-label">
          {{ currentTime.getHours().toString().padStart(2, '0') }}:{{ currentTime.getMinutes().toString().padStart(2, '0') }}
        </span>
      </div>
      
      <!-- 鼠标悬停时间线 -->
      <div 
        class="hover-time-line"
        v-if="showHoverTimeLine"
        :style="{ top: `${hoverTimePosition}px` }"
      >
        <span class="hover-time-label">
          {{ hoverTimeText }}
        </span>
      </div>

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
            'three-day-view-column': currentView === 'threeDay',
            'week-view-column': currentView === 'week',
            'today-column': date.format('YYYY-MM-DD') === todayDateString
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
              v-if="!task.completed"
              :style="getResizeHandleStyle(task)"
            ></div>
            <div 
              class="task-content" 
              :class="{ 
                'standard-mode': !isCompactTask(task) && !isVerySmallTask(task),
                'compact-mode': isCompactTask(task) && !isVerySmallTask(task),
                'very-small-mode': isVerySmallTask(task),
                'hide-time': currentView === 'threeDay' || currentView === 'week'
              }"
            >
              <span class="task-name">{{ task.name }}</span>
              <span 
                v-if="!isVerySmallTask(task) && currentView === 'day'" 
                class="task-time"
              >{{ task.startTime }} - {{ task.endTime }}</span>
            </div>
            <div 
              class="resize-handle-bottom" 
              @mousedown.stop="startResizing($event, task, 'bottom')"
              v-if="!task.completed"
              :style="getResizeHandleStyle(task)"
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
      @click.stop
    >
      <div class="form-header">
        <h3>{{ editingTask.id ? '编辑待办' : '新建待办' }}</h3>
      </div>
      <div class="form-body">
        <div class="form-group">
          <label>待办名称:</label>
          <input 
            type="text" 
            v-model="editingTask.name" 
            placeholder="请输入待办名称" 
            @click.stop 
          />
        </div>
        <div class="form-group">
          <label>开始时间:</label>
          <input 
            type="time" 
            v-model="editingTask.startTime" 
            @click.stop
          />
        </div>
        <div class="form-group">
          <label>结束时间:</label>
          <input 
            type="time" 
            v-model="editingTask.endTime" 
            @click.stop
          />
        </div>
      </div>
      <div class="form-footer">
        <button @click.stop="cancelTaskForm">取消</button>
        <button @click.stop="saveTask" class="primary">确定</button>
      </div>
    </div>

    <!-- 任务浮窗菜单 -->
    <div 
      v-if="showTaskMenu" 
      class="task-menu"
      :style="{ top: `${taskMenuPosition.y}px`, left: `${taskMenuPosition.x}px` }"
      @click.stop
    >
      <div @click.stop="completeSelectedTask" class="menu-item">{{ selectedTask && selectedTask.completed ? '取消完成' : '完成' }}</div>
      <div @click.stop="editSelectedTask" class="menu-item">编辑</div>
      <div @click.stop="deleteSelectedTask" class="menu-item delete">删除</div>
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
        week: '一周',
        clickTimer: null,
      },
      timeScale: 1.75, // 修改默认每分钟对应1.75像素
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
      dragInfo: {
        offsetY: 0,  // 鼠标与待办事项顶部的Y轴偏移
        taskId: null,  // 正在拖拽的任务ID
        originalTask: null // 保存拖拽任务的原始状态
      },
      heightObserver: null,
      currentTime: new Date(), // 当前时间
      currentTimeInterval: null, // 用于存储定时器ID
      justClosedFloatingWindow: false, // 新增：标记是否刚刚关闭了浮窗
      // 新增：鼠标悬停时间线相关数据
      showHoverTimeLine: false, // 是否显示鼠标悬停时间线
      hoverTimePosition: 0, // 鼠标悬停时间线位置
      hoverTimeText: '00:00', // 鼠标悬停时间线显示的时间文本
    };
  },
  computed: {
    viewDates() {
      const today = dayjs();
      const dates = [];
      
      if (this.currentView === 'day') {
        dates.push(today);
      } else if (this.currentView === 'threeDay') {
        // 获取当前是星期几(0-6，0表示星期日)
        const dayOfWeek = today.day();
        
        if (dayOfWeek === 0) {
          // 周日：显示为最右侧的一列
          dates.push(today.subtract(2, 'day'));
          dates.push(today.subtract(1, 'day'));
          dates.push(today);
        } else if (dayOfWeek === 1) {
          // 周一：显示为最左侧的一列
          dates.push(today);
          dates.push(today.add(1, 'day'));
          dates.push(today.add(2, 'day'));
        } else {
          // 其他日期：固定在中间一列
          dates.push(today.subtract(1, 'day'));
          dates.push(today);
          dates.push(today.add(1, 'day'));
        }
      } else if (this.currentView === 'week') {
        // 获取当周周一
        const monday = today.startOf('week');
        // 添加从周一到周日的7天
        for (let i = 1; i < 8; i++) {
          dates.push(monday.add(i, 'day'));
        }
      }
      
      return dates;
    },
    
    // 获取今天的日期字符串，用于高亮当天列
    todayDateString() {
      return dayjs().format('YYYY-MM-DD');
    },
    
    // 计算当前时间线的位置
    currentTimePosition() {
      const hours = this.currentTime.getHours();
      const minutes = this.currentTime.getMinutes();
      const totalMinutes = hours * 60 + minutes;
      return totalMinutes * this.timeScale;
    }
  },
  mounted() {
    // 全局事件监听
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.stopResizing);
    window.addEventListener('click', this.closeMenus);
    window.addEventListener('resize', this.onWindowResize);
    
    // 添加全局点击监听，用于关闭浮窗
    document.addEventListener('click', this.closeAllFloatingWindows);
    
    // 初始设置时间单位比例和同步高度
    this.calculateTimeScale();
    this.syncPanelHeight();
    
    // 初始化滚动位置
    this.$nextTick(() => {
      this.scrollToWorkingHours();
    });
    
    // 创建MutationObserver监听DOM变化，确保高度同步
    this.setupHeightObserver();
    
    // 设置每分钟更新一次当前时间的定时器
    this.currentTimeInterval = setInterval(() => {
      this.currentTime = new Date();
    }, 60000); // 每分钟更新一次
  },
  beforeUnmount() {
    // 清除全局事件监听
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.stopResizing);
    window.removeEventListener('click', this.closeMenus);
    window.removeEventListener('resize', this.onWindowResize);
    
    // 移除全局点击监听
    document.removeEventListener('click', this.closeAllFloatingWindows);
    
    // 清除高度观察器
    if (this.heightObserver) {
      this.heightObserver.disconnect();
    }
    
    // 清除当前时间定时器
    if (this.currentTimeInterval) {
      clearInterval(this.currentTimeInterval);
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
      // 保持固定的1.75像素/分钟比例
      this.$nextTick(() => {
        this.timeScale = 1.75;
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
      
      const styles = {
        top: `${top}px`,
        height: `${height}px`
      };
      
      // 为已完成的任务添加特殊样式，使其看起来是锁定的
      if (task.completed) {
        styles.cursor = 'not-allowed';
        styles.opacity = '0.7';
      }
      
      return styles;
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
      
      // 当持续时间小于70分钟时使用紧凑模式（原来是40分钟，乘以1.75）
      return durationMinutes < 70;
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
      
      // 当持续时间小于30分钟时认为是超小任务（原来是18分钟，乘以1.75）
      return durationMinutes < 30;
    },
    
    // 新增方法：根据任务持续时间计算拉伸边缘高度
    getResizeHandleStyle(task) {
      if (!task.startTime || !task.endTime) return {};
      
      // 解析时间
      const [startHour, startMinute] = task.startTime.split(':').map(Number);
      const [endHour, endMinute] = task.endTime.split(':').map(Number);
      
      // 计算任务持续时间（分钟）
      const startMinutes = startHour * 60 + startMinute;
      const endMinutes = endHour * 60 + endMinute;
      const durationMinutes = endMinutes - startMinutes;
      
      // 当持续时间大于等于30分钟时，边缘高度为标准值7px
      if (durationMinutes >= 30) {
        return { height: '12.25px' }; // 7px * 1.75
      } else {
        // 当持续时间小于30分钟时，边缘高度逐渐减小
        // 从30分钟时的7px线性减小到5分钟时的最小值
        const minHeight = 1.75; // 最小高度 1px * 1.75
        const maxHeight = 12.25; // 最大高度 7px * 1.75
        
        // 计算5-30分钟区间的比例
        const ratio = Math.max(0, (durationMinutes - 5) / 25);
        
        // 线性插值计算高度
        const height = minHeight + ratio * (maxHeight - minHeight);
        
        // 确保两个边缘的总高度不超过任务块的实际高度(减去一个最小内容高度)
        const minContentHeight = 10.5; // 最小内容高度 6px * 1.75
        const taskHeight = durationMinutes * this.timeScale;
        
        // 如果两个边缘总高度会超过任务块高度，则按比例缩小
        if (2 * height + minContentHeight > taskHeight) {
          // 两个边缘最多占用任务块高度的80%，留20%给内容区
          const maxEdgeHeight = (taskHeight - minContentHeight) / 2;
          return { height: `${Math.max(minHeight, maxEdgeHeight)}px` };
        }
        
        return { height: `${height}px` };
      }
    },
    
    // 修改任务表单打开方法
    openTaskForm(task) {
      this.editingTask = { ...task };
      this.showTaskForm = true;
    },
    
    // 创建待办事项时弹出表单
    onTimelineClick(event) {
      // 隐藏鼠标悬停时间线
      this.hideHoverTimeLine();
      
      // 如果刚刚关闭了浮窗或者正在拉伸/刚结束拉伸任务，不处理此次点击
      if (this.justClosedFloatingWindow || 
          (this.resizing && (this.resizing.active || this.resizing.isResizing))) {
        return;
      }
      
      // 如果点击在时间刻度上，不创建任务
      if (event.target.closest('.time-scale') || 
          event.target.classList.contains('hour-grid') ||
          event.target.classList.contains('timeline-grid')) {
        return;
      }
      
      // 如果点击的是任务或者菜单，不创建任务
      if (event.target.closest('.task-block') || 
          this.showTaskForm || 
          this.showTaskMenu || 
          this.showContextMenu) {
        return;
      }
      
      // 关闭任何打开的菜单
      this.showTaskMenu = false;
      
      // 打开新任务创建表单
      this.createTaskAtPosition(event);
      
      // 阻止事件冒泡
      event.stopPropagation();
    },
    
    getTimelineRect() {
      const timeline = this.$refs.timelineContainer;
      return timeline.getBoundingClientRect();
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
      // 如果点击是在任务浮窗之外，则关闭它
      if (this.showTaskMenu && !event.target.closest('.task-menu') && !event.target.closest('.task-block')) {
        this.showTaskMenu = false;
      }
      
      // 如果点击是在表单浮窗之外，则关闭它
      if (this.showTaskForm && !event.target.closest('.task-form')) {
        this.showTaskForm = false;
      }
    },

    toggleTaskCompletion(task) {
      if (this.clickTimer) {
        clearTimeout(this.clickTimer);
        this.clickTimer = null;
      }
      this.$emit('complete-task', task);
    },

    calcMenuPosition(event) {
      const pos = { x: event.clientX, y: event.clientY };
      // 确保菜单位置在可视区域内
      return this.adjustFloatingWindowPosition(pos, 140, 120);
    },
    
    // 任务点击处理 - 显示任务菜单
    taskClick(event, task) {
      // 隐藏鼠标悬停时间线
      this.hideHoverTimeLine();
      // 阻止拉伸区域点击
      if (event.target.classList.contains('resize-handle') || this.resizing?.active) return;
      
      // 清除已有计时器
      if (this.clickTimer) {
        clearTimeout(this.clickTimer);
        this.clickTimer = null;
        return;
      }

      // 设置新的单击计时器
      this.clickTimer = setTimeout(() => {
        this.showTaskMenu = true;
        this.selectedTask = task;
        this.taskMenuPosition = this.calcMenuPosition(event);
        this.clickTimer = null;
      }, 200); // 200ms 延迟用于区分单击双击

    // 修改后的双击处理

      // 如果已经有浮窗打开（任务菜单或表单），则关闭浮窗并阻止打开新浮窗 
      if (this.showTaskMenu || this.showTaskForm) {
        this.showTaskMenu = false;
        this.showTaskForm = false;
        
        // 设置标志位，防止在同一点击中触发其他事件
        this.justClosedFloatingWindow = true;
        
        // 使用setTimeout在下一个事件循环中重置标志位
        setTimeout(() => {
          this.justClosedFloatingWindow = false;
        }, 50);
        
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      
      // 设置选中的任务
      this.selectedTask = task;
      
      // 根据点击位置计算菜单位置
      const menuPosition = {
        x: event.clientX,
        y: event.clientY
      };
      
      // 估计菜单窗口大小（根据实际CSS调整）
      const estimatedMenuWidth = 140; // 缩小后的菜单宽度
      const estimatedMenuHeight = 120; // 三个菜单项高度估计值（缩小后）
      
      // 调整位置确保菜单完全可见
      this.taskMenuPosition = this.adjustFloatingWindowPosition(
        menuPosition, 
        estimatedMenuWidth, 
        estimatedMenuHeight
      );
      
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
        // 使用任务菜单当前位置作为起点
        const formPosition = { 
          x: this.taskMenuPosition.x, 
          y: this.taskMenuPosition.y 
        };
        
        // 更精确的表单窗口大小估计
        const estimatedFormWidth = 320; // 更新的表单宽度估计值
        const estimatedFormHeight = 350; // 更新的表单高度估计值
        
        // 调整位置确保表单完全可见
        this.formPosition = this.adjustFloatingWindowPosition(
          formPosition, 
          estimatedFormWidth, 
          estimatedFormHeight
        );
        
        this.openTaskForm(this.selectedTask);
        this.showTaskMenu = false;
        
        // 在DOM更新后检查表单实际尺寸并调整位置
        this.$nextTick(() => {
          const formElement = document.querySelector('.task-form-container');
          if (formElement) {
            const actualWidth = formElement.offsetWidth;
            const actualHeight = formElement.offsetHeight;
            
            // 如果实际尺寸与估计值有显著差异，重新调整位置
            if (Math.abs(actualWidth - estimatedFormWidth) > 30 || 
                Math.abs(actualHeight - estimatedFormHeight) > 30) {
              this.formPosition = this.adjustFloatingWindowPosition(
                this.formPosition,
                actualWidth,
                actualHeight
              );
            }
          }
        });
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
      // 隐藏鼠标悬停时间线
      this.hideHoverTimeLine();
      
      // 如果任务已完成，不允许调整大小
      if (task.completed) {
        event.preventDefault();
        event.stopPropagation(); 
        return;
      }
      
      // 保存当前任务和调整方向
      this.resizing = {
        active: true,
        task: { ...task },
        edge: edge,
        initialY: event.clientY,
        initialTime: edge === 'top' ? task.startTime : task.endTime,
        isResizing: true  // 添加标记表示正在拉伸
      };
      
      // 添加mouseup事件监听器
      document.addEventListener('mouseup', this.handleResizeEnd, { once: true });
      
      event.preventDefault(); // 防止触发拖拽
      event.stopPropagation(); // 阻止冒泡
    },
    
    handleResizeEnd() {
      // 设置一个短暂的延时，防止触发taskClick
      this.resizing.isResizing = true; // 立即标记为正在拉伸状态结束中
      
      setTimeout(() => {
        this.resizing.isResizing = false;
      }, 300); // 增加延迟时间，确保不会触发新建待办操作
      
      this.resizing.active = false;
      this.hideResizeTimeIndicator();
    },
    
    onMouseMove(event) {
      if (!this.resizing.active) return;
      
      const timelineRect = this.getTimelineRect();
      const deltaY = event.clientY - this.resizing.initialY;
      
      // 计算当前鼠标位置对应的时间
      let yPosition = event.clientY - timelineRect.top + this.$refs.timelineContainer.scrollTop;
      
      // 计算分钟数并对齐到5分钟
      let minutes = Math.floor(yPosition / this.timeScale);
      let alignedMinutes = Math.round(minutes / 5) * 5;
      
      // 确保时间在有效范围内
      alignedMinutes = Math.max(0, Math.min(alignedMinutes, 24 * 60 - 1));
      
      // 计算对齐后的实际像素位置
      const alignedPosition = alignedMinutes * this.timeScale;
      
      // 格式化时间显示
      const hour = Math.floor(alignedMinutes / 60);
      const minute = alignedMinutes % 60;
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      
      if (this.resizing.edge === 'top') {
        // 调整开始时间
        const [endHours, endMinutes] = this.resizing.task.endTime.split(':').map(Number);
        const endTotalMinutes = endHours * 60 + endMinutes;
        
        // 确保与结束时间的间隔至少为5分钟
        alignedMinutes = Math.min(alignedMinutes, endTotalMinutes - 5);
        
        let startTime = `${Math.floor(alignedMinutes / 60).toString().padStart(2, '0')}:${(alignedMinutes % 60).toString().padStart(2, '0')}`;
        
        // 显示时间指示器
        this.showResizeTimeIndicator(alignedPosition, timeString, 'top');
        
        this.$emit('update-task-time', {
          ...this.resizing.task,
          startTime
        });
      } else if (this.resizing.edge === 'bottom') {
        // 调整结束时间
        const [startHours, startMinutes] = this.resizing.task.startTime.split(':').map(Number);
        const startTotalMinutes = startHours * 60 + startMinutes;
        
        // 确保与开始时间的间隔至少为5分钟
        alignedMinutes = Math.max(alignedMinutes, startTotalMinutes + 5);
        
        const endTime = `${Math.floor(alignedMinutes / 60).toString().padStart(2, '0')}:${(alignedMinutes % 60).toString().padStart(2, '0')}`;
        
        // 显示时间指示器
        this.showResizeTimeIndicator(alignedPosition, timeString, 'bottom');
        
        this.$emit('update-task-time', {
          ...this.resizing.task,
          endTime
        });
      }
    },
    
    stopResizing() {
      // 设置标记表示刚刚结束了拉伸操作
      if (this.resizing) {
        this.resizing.isResizing = true;
        
        setTimeout(() => {
          this.resizing.isResizing = false;
        }, 300); // 延迟300毫秒后清除标记
      }
      
      this.resizing.active = false;
      // 移除时间指示器
      const indicator = document.getElementById('resize-time-indicator');
      if (indicator) {
        document.body.removeChild(indicator);
      }
    },
    
    onDragOver(event) {
      event.preventDefault();
      
      // 获取时间刻度区域位置
      const timelineRect = this.getTimelineRect();
      
      // 确保鼠标在时间轴区域内
      if (this.isMouseOverTimeline(event)) {
        // 计算鼠标位置对应的时间
        let yPosition = event.clientY - timelineRect.top + this.$refs.timelineContainer.scrollTop;
        
        // 考虑拖拽偏移
        if (this.dragInfo.offsetY) {
          yPosition -= this.dragInfo.offsetY;
        }
        
        // 确保值在有效范围内
        yPosition = Math.max(0, yPosition);
        
        // 计算分钟
        const minutes = Math.floor(yPosition / this.timeScale);
        
        // 将分钟对齐到最近的5分钟，使用Math.round实现更自然的磁吸效果
        const alignedMinutes = Math.round(minutes / 5) * 5;
        
        // 计算对齐后的实际像素位置
        const alignedPosition = (alignedMinutes * this.timeScale);
        
        // 计算小时和分钟
        const hour = Math.floor(alignedMinutes / 60);
        const minute = alignedMinutes % 60;
        
        // 格式化时间字符串
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        
        // 显示时间指示器，使用对齐后的位置
        this.showDragTimeIndicator(alignedPosition, timeString);
      } else {
        // 隐藏时间指示器
        this.hideDragTimeIndicator();
      }
    },
    
    // 判断鼠标是否在时间轴区域内
    isMouseOverTimeline(event) {
      const timelineContainer = this.$refs.timelineContainer;
      const rect = timelineContainer.getBoundingClientRect();
      
      return (
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      );
    },
    
    // 显示拖拽时间指示器
    showDragTimeIndicator(yPosition, timeString) {
      // 检查指示器是否已存在
      let indicator = document.getElementById('drag-time-indicator');
      
      if (!indicator) {
        // 创建指示器元素
        indicator = document.createElement('div');
        indicator.id = 'drag-time-indicator';
        indicator.className = 'drag-time-indicator';
        document.body.appendChild(indicator);
      }
      
      // 更新指示器位置和内容
      const timelineContainer = this.$refs.timelineContainer;
      const rect = timelineContainer.getBoundingClientRect();
      
      indicator.style.top = `${rect.top + yPosition - timelineContainer.scrollTop}px`;
      indicator.style.left = `${rect.left}px`;
      indicator.textContent = timeString;
    },
    
    // 隐藏拖拽时间指示器
    hideDragTimeIndicator() {
      const indicator = document.getElementById('drag-time-indicator');
      if (indicator) {
        document.body.removeChild(indicator);
      }
    },
    
    onTaskDragStart(event, task) {
      // 只有在非调整大小的情况下才允许拖拽
      if (this.resizing.active) {
        event.preventDefault();
        return;
      }
      
      // 如果任务已完成，阻止拖拽
      if (task.completed) {
        event.preventDefault();
        return;
      }
      
      // 关闭任何打开的菜单
      this.showTaskMenu = false;
      
      // 计算鼠标相对于任务块顶部的偏移量
      const taskElement = event.currentTarget;
      const taskRect = taskElement.getBoundingClientRect();
      
      // 保存鼠标相对于任务顶部的Y轴偏移量
      this.dragInfo = {
        offsetY: event.clientY - taskRect.top,
        taskId: task.id.toString(),
        originalTask: { ...task } // 保存原始任务状态
      };
      
      // 设置拖拽元素的透明度
      taskElement.style.opacity = '0.7';
      
      // 保存任务ID和任务信息用于拖拽
      event.dataTransfer.setData('taskId', task.id.toString());
      event.dataTransfer.setData('taskData', JSON.stringify(task));
      // 设置拖拽效果
      event.dataTransfer.effectAllowed = 'move';
      
      // 添加拖拽结束事件监听
      taskElement.addEventListener('dragend', () => {
        // 恢复原来的透明度
        taskElement.style.opacity = '1';
        
        // 移除时间指示器
        this.hideDragTimeIndicator();
      }, { once: true });
    },
    
    onDrop(event) {
      // 隐藏时间指示器
      this.hideDragTimeIndicator();

      // 阻止默认行为
      event.preventDefault();
      
      const taskId = event.dataTransfer.getData('taskId');
      if (!taskId) return;
      
      // 计算放置位置对应的时间
      const rect = this.getTimelineRect();
      
      // 考虑鼠标与任务顶部的偏移量，计算任务顶部应该在的位置
      let yOffset = 0;
      
      // 确保拖拽的是同一个任务
      if (this.dragInfo.taskId === taskId) {
        yOffset = this.dragInfo.offsetY;
      }
      
      // 调整Y位置，考虑鼠标与任务顶部的偏移量
      const y = (event.clientY - yOffset) - rect.top + this.$refs.timelineContainer.scrollTop;
      const dateColumn = event.target.closest('.date-column');
      
      if (!dateColumn) {
        this.resetDraggedTask(taskId);
        return;
      }
      
      const dateStr = dateColumn.dataset.date;
      const minutes = Math.floor(y / this.timeScale);
      
      // 将分钟对齐到最近的5分钟
      // 使用Math.round而不是Math.floor，这样可以更自然地吸附到最近的5分钟刻度
      const alignedMinutes = Math.max(0, Math.min(Math.round(minutes / 5) * 5, 24 * 60 - 5));
      
      // 计算小时和分钟
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
          // 重新计算开始时间，确保任务持续时间不变
          const adjustedStartMinutes = newEndMinutes - durationMinutes;
          if (adjustedStartMinutes >= 0) {
            const adjustedStartHour = Math.floor(adjustedStartMinutes / 60);
            const adjustedStartMinute = adjustedStartMinutes % 60;
            const adjustedStartTime = `${adjustedStartHour.toString().padStart(2, '0')}:${adjustedStartMinute.toString().padStart(2, '0')}`;
            // 更新开始时间
            startTime = adjustedStartTime;
          }
        }
        
        const newEndHour = Math.floor(newEndMinutes / 60);
        const newEndMinute = newEndMinutes % 60;
        const endTime = `${newEndHour.toString().padStart(2, '0')}:${newEndMinute.toString().padStart(2, '0')}`;
        
        // 检查是否与其他任务有重叠
        const overlappingTasks = this.checkForOverlappingTasks(dateStr, startTime, endTime, task.id);
        
        if (overlappingTasks.length > 0) {
          // 找出重叠任务中开始时间最早的那个
          const firstOverlap = overlappingTasks.reduce((earliest, current) => {
            const [earliestHour, earliestMinute] = earliest.startTime.split(':').map(Number);
            const [currentHour, currentMinute] = current.startTime.split(':').map(Number);
            
            const earliestMinutes = earliestHour * 60 + earliestMinute;
            const currentMinutes = currentHour * 60 + currentMinute;
            
            return earliestMinutes < currentMinutes ? earliest : current;
          });
          
          // 计算重叠任务的开始时间（分钟）
          const [overlapHour, overlapMinute] = firstOverlap.startTime.split(':').map(Number);
          const overlapStartMinutes = overlapHour * 60 + overlapMinute;
          
          // 调整结束时间，使其不与重叠任务重叠
          if (overlapStartMinutes <= alignedMinutes) {
            // 如果重叠任务的开始时间在当前任务的开始时间之前或相同，则无法放置
            this.resetDraggedTask(taskId);
            return;
          }
          
          // 否则，缩短当前任务的持续时间
          const newDurationMinutes = overlapStartMinutes - alignedMinutes;
          
          // 如果缩短后的持续时间不足15分钟，则取消拖拽
          if (newDurationMinutes < 15) {
            this.resetDraggedTask(taskId);
            return;
          }
          
          // 更新结束时间
          newEndMinutes = alignedMinutes + newDurationMinutes;
          const adjustedEndHour = Math.floor(newEndMinutes / 60);
          const adjustedEndMinute = newEndMinutes % 60;
          const adjustedEndTime = `${adjustedEndHour.toString().padStart(2, '0')}:${adjustedEndMinute.toString().padStart(2, '0')}`;
          
          // 更新任务的时间信息
          this.$emit('schedule-task', {
            ...task,
            date: dateStr,
            startTime,
            endTime: adjustedEndTime
          });
        } else {
          // 无重叠，正常更新任务的时间信息
          this.$emit('schedule-task', {
            ...task,
            date: dateStr,
            startTime,
            endTime
          });
        }
        
        // 清理拖拽信息
        this.dragInfo = { offsetY: 0, taskId: null, originalTask: null };
      }
    },
    
    // 添加新方法检查任务重叠
    checkForOverlappingTasks(date, startTime, endTime, taskId) {
      // 将开始和结束时间转换为分钟
      const [startHour, startMinute] = startTime.split(':').map(Number);
      const [endHour, endMinute] = endTime.split(':').map(Number);
      
      const startMinutes = startHour * 60 + startMinute;
      const endMinutes = endHour * 60 + endMinute;
      
      // 查找当天同一列的所有其他任务
      return this.todos.filter(task => {
        // 排除自己
        if (task.id.toString() === taskId.toString()) return false;
        
        // 排除不同日期的任务
        if (task.date !== date) return false;
        
        // 排除没有时间信息的任务
        if (!task.startTime || !task.endTime) return false;
        
        // 计算任务的开始和结束时间（分钟）
        const [taskStartHour, taskStartMinute] = task.startTime.split(':').map(Number);
        const [taskEndHour, taskEndMinute] = task.endTime.split(':').map(Number);
        
        const taskStartMinutes = taskStartHour * 60 + taskStartMinute;
        const taskEndMinutes = taskEndHour * 60 + taskEndMinute;
        
        // 检查是否有重叠
        // (开始时间在任务的时间范围内) 或 (结束时间在任务的时间范围内) 或 (任务完全包含当前时间范围)
        return (startMinutes >= taskStartMinutes && startMinutes < taskEndMinutes) || 
               (endMinutes > taskStartMinutes && endMinutes <= taskEndMinutes) ||
               (startMinutes <= taskStartMinutes && endMinutes >= taskEndMinutes);
      });
    },
    
    // 添加新方法重置拖拽的任务
    resetDraggedTask(taskId) {
      if (this.dragInfo.originalTask && this.dragInfo.originalTask.id.toString() === taskId) {
        // 恢复任务到原始状态
        this.$emit('update-task', this.dragInfo.originalTask);
      }
      // 清理拖拽信息
      this.dragInfo = { offsetY: 0, taskId: null, originalTask: null };
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
      
      // 滚动到上午7:30的位置
      const workingHourMinutes = 7 * 60 + 30; // 7:30 AM
      const scrollTop = workingHourMinutes * this.timeScale - 10; // 减去一些偏移，让7:30位于视图上方
      
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
      const uiElementsHeight = 140; // 估计值，包括标题和按钮等高度 (80px * 1.75)
      const availableHeight = Math.max(leftPanelHeight - uiElementsHeight, 700); // 确保最小高度为700px (400px * 1.75)
      
      container.style.minHeight = `${availableHeight}px`;
      container.style.maxHeight = `${availableHeight}px`;
      
      // 确保内容高度足够显示完整时间轴
      const innerContent = container.querySelector('.timeline-grid');
      if (innerContent) {
        innerContent.style.minHeight = `${timelineHeight}px`;
      }
    },
    
    // 确保浮窗在视窗内可见
    adjustFloatingWindowPosition(position, windowWidth, windowHeight) {
      const safeMargin = 25; // 安全边距，防止窗口太靠近边缘
      
      // 获取视窗尺寸和滚动位置
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight,
        scrollX: window.pageXOffset || document.documentElement.scrollLeft,
        scrollY: window.pageYOffset || document.documentElement.scrollTop
      };
      
      // 创建新的位置对象，避免修改原始对象
      const adjustedPosition = {
        x: position.x,
        y: position.y
      };
      
      // 处理X轴位置 - 考虑滚动位置
      // 如果窗口超出右边界
      if (adjustedPosition.x + windowWidth > viewport.width + viewport.scrollX - safeMargin) {
        // 如果窗口宽度超过视窗宽度，则居中显示
        if (windowWidth > viewport.width - 2 * safeMargin) {
          adjustedPosition.x = viewport.scrollX + safeMargin;
        } else {
          adjustedPosition.x = viewport.width + viewport.scrollX - windowWidth - safeMargin;
        }
      }
      
      // 确保X轴不小于安全边距（考虑滚动）
      if (adjustedPosition.x < viewport.scrollX + safeMargin) {
        adjustedPosition.x = viewport.scrollX + safeMargin;
      }
      
      // 处理Y轴位置 - 考虑滚动位置
      // 如果窗口超出底部边界
      if (adjustedPosition.y + windowHeight > viewport.height + viewport.scrollY - safeMargin) {
        // 如果窗口高度超过视窗高度，则从顶部显示
        if (windowHeight > viewport.height - 2 * safeMargin) {
          adjustedPosition.y = viewport.scrollY + safeMargin;
        } else {
          adjustedPosition.y = viewport.height + viewport.scrollY - windowHeight - safeMargin;
        }
      }
      
      // 确保Y轴不小于安全边距（考虑滚动）
      if (adjustedPosition.y < viewport.scrollY + safeMargin) {
        adjustedPosition.y = viewport.scrollY + safeMargin;
      }
      
      // 最终检查确保位置在视窗范围内
      adjustedPosition.x = Math.max(viewport.scrollX + safeMargin, 
                           Math.min(adjustedPosition.x, 
                                   viewport.width + viewport.scrollX - windowWidth - safeMargin));
      adjustedPosition.y = Math.max(viewport.scrollY + safeMargin, 
                           Math.min(adjustedPosition.y, 
                                   viewport.height + viewport.scrollY - windowHeight - safeMargin));
      
      return adjustedPosition;
    },
    
    // 全局点击处理，关闭所有浮窗
    closeAllFloatingWindows(event) {
      const wasAnyWindowOpen = this.showTaskForm || this.showTaskMenu;
      
      // 如果点击在浮窗内部，不处理
      if (event.target.closest('.task-form') || 
          event.target.closest('.task-menu') ||
          event.target.closest('.task-block')) {
        return;
      }
      
      // 关闭任务表单
      this.showTaskForm = false;
      
      // 关闭任务菜单
      this.showTaskMenu = false;
      
      // 如果关闭了任何浮窗，设置标志位
      if (wasAnyWindowOpen) {
        this.justClosedFloatingWindow = true;
        
        // 使用setTimeout在下一个事件循环中重置标志位
        setTimeout(() => {
          this.justClosedFloatingWindow = false;
        }, 50);
        
        // 阻止事件传播，以防止在同一点击中触发其他事件
        event.preventDefault();
        event.stopPropagation();
      }
      
      // 发送事件通知其他组件关闭浮窗
      this.$emit('close-all-floating-windows');
    },
    
    // 根据点击位置创建新任务表单
    createTaskAtPosition(event) {
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
      
      // 获取视窗尺寸
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight,
        scrollX: window.pageXOffset || document.documentElement.scrollLeft,
        scrollY: window.pageYOffset || document.documentElement.scrollTop
      };
      
      // 设置表单位置
      const formPosition = {
        x: event.clientX,
        y: event.clientY
      };
      
      // 估计表单窗口大小
      const estimatedFormWidth = 320;  // 表单宽度
      const estimatedFormHeight = 350; // 表单高度估计值
      const safeMargin = 25; // 安全边距
      
      // 调整X轴位置
      if (formPosition.x + estimatedFormWidth > viewport.width + viewport.scrollX - safeMargin) {
        formPosition.x = viewport.width + viewport.scrollX - estimatedFormWidth - safeMargin;
      }
      if (formPosition.x < viewport.scrollX + safeMargin) {
        formPosition.x = viewport.scrollX + safeMargin;
      }
      
      // 调整Y轴位置
      if (formPosition.y + estimatedFormHeight > viewport.height + viewport.scrollY - safeMargin) {
        formPosition.y = viewport.height + viewport.scrollY - estimatedFormHeight - safeMargin;
      }
      if (formPosition.y < viewport.scrollY + safeMargin) {
        formPosition.y = viewport.scrollY + safeMargin;
      }
      
      // 创建新任务对象
      this.editingTask = {
        id: null,
        name: '新待办',
        date: dateStr,
        startTime,
        endTime,
        completed: false
      };
      
      // 设置表单位置并显示
      this.formPosition = formPosition;
      this.showTaskForm = true;
      
      // 在DOM更新后检查表单实际尺寸并调整位置
      this.$nextTick(() => {
        const formElement = document.querySelector('.task-form');
        if (formElement) {
          const actualWidth = formElement.offsetWidth;
          const actualHeight = formElement.offsetHeight;
          
          // 如果实际尺寸与估计值有显著差异，重新调整位置
          if (Math.abs(actualWidth - estimatedFormWidth) > 30 || 
              Math.abs(actualHeight - estimatedFormHeight) > 30) {
            this.formPosition = this.adjustFloatingWindowPosition(
              this.formPosition,
              actualWidth,
              actualHeight
            );
          }
        }
      });
    },
    
    // 添加新方法：显示拉伸时的时间指示器
    showResizeTimeIndicator(yPosition, timeString, edge) {
      // 检查指示器是否已存在
      let indicator = document.getElementById('resize-time-indicator');
      
      if (!indicator) {
        // 创建指示器元素
        indicator = document.createElement('div');
        indicator.id = 'resize-time-indicator';
        indicator.className = 'resize-time-indicator';
        document.body.appendChild(indicator);
      }
      
      // 更新指示器位置和内容
      const timelineContainer = this.$refs.timelineContainer;
      const rect = timelineContainer.getBoundingClientRect();
      
      // 根据拉伸边缘调整指示器位置
      const topOffset = edge === 'top' ? -20 : 0; // 顶部边缘时，指示器显示在上方
      
      indicator.style.top = `${rect.top + yPosition - timelineContainer.scrollTop + topOffset}px`;
      indicator.style.left = `${rect.left}px`;
      indicator.textContent = timeString;
    },
    
    // 隐藏拉伸时的时间指示器
    hideResizeTimeIndicator() {
      const indicator = document.getElementById('resize-time-indicator');
      if (indicator) {
        document.body.removeChild(indicator);
      }
    },
    
    // 处理鼠标在时间轴上移动
    handleTimelineMouseMove(event) {
      // 如果有弹窗显示或正在拉伸，不显示悬停时间线
      if (this.showTaskForm || this.showTaskMenu || this.resizing.active) {
        this.hideHoverTimeLine();
        return;
      }
      
      // 检查鼠标是否在任务块上
      if (event.target.closest('.task-block')) {
        this.hideHoverTimeLine();
        return;
      }
      
      // 获取时间刻度区域位置
      const timelineRect = this.getTimelineRect();
      
      // 计算鼠标位置对应的时间
      const yPosition = event.clientY - timelineRect.top + this.$refs.timelineContainer.scrollTop;
      
      // 计算分钟数
      const minutes = Math.floor(yPosition / this.timeScale);
      
      // 确保时间在有效范围内 (0:00 - 23:59)
      if (minutes < 0 || minutes >= 24 * 60) {
        this.hideHoverTimeLine();
        return;
      }
      
      // 计算小时和分钟
      const hour = Math.floor(minutes / 60);
      const minute = minutes % 60;
      
      // 格式化时间文本
      this.hoverTimeText = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      
      // 设置时间线位置
      this.hoverTimePosition = yPosition;
      
      // 显示时间线
      this.showHoverTimeLine = true;
    },
    
    // 隐藏鼠标悬停时间线
    hideHoverTimeLine() {
      this.showHoverTimeLine = false;
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
  gap: 17.5px; /* 10px * 1.75 */
  margin-bottom: 17.5px; /* 10px * 1.75 */
}

.view-controls button {
  padding: 10.5px 21px; /* 6px * 1.75, 12px * 1.75 */
  border: 1.75px solid #ddd; /* 1px * 1.75 */
  background: #f5f5f5;
  cursor: pointer;
  border-radius: 7px; /* 4px * 1.75 */
  font-size: 17.5px; /* 10px * 1.75 */
}

.view-controls button.active {
  background: #007bff;
  color: white;
  border-color: #0069d9;
}

.date-headers {
  display: flex;
  border-bottom: 1.75px solid #ddd; /* 1px * 1.75 */
  width: 100%;
}

.time-slot-header {
  width: 105px; /* 60px * 1.75 */
  flex-shrink: 0;
}

.date-header {
  flex: 1;
  padding: 17.5px; /* 10px * 1.75 */
  text-align: center;
  font-weight: bold;
  border-left: 1.75px solid #eee; /* 1px * 1.75 */
  font-size: 17.5px; /* 10px * 1.75 */
}

/* 日视图下的表头宽度固定 */
.date-header.day-view-header {
  flex: 0 0 525px; /* 300px * 1.75 */
  width: 525px; /* 300px * 1.75 */
}

/* 三日视图下的表头宽度固定 */
.date-header.three-day-view-header {
  flex: 0 0 220px; /* 减小宽度以显示全部三列 */
  width: 220px; /* 减小宽度以显示全部三列 */
}

/* 一周视图下的表头宽度固定 */
.date-header.week-view-header {
  flex: 0 0 100px; /* 减小宽度以显示全部七列 */
  width: 100px; /* 减小宽度以显示全部七列 */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 10px 5px; /* 减小内边距 */
}

.timeline-container {
  flex: 1;
  overflow-y: auto;
  position: relative;
  display: flex;
  /* 时间轴容器高度将由JS动态设置 */
  min-height: 700px; /* 400px * 1.75 */
  height: auto;
}

/* 确保时间轴的滚动条显示正常 */
.timeline-container::-webkit-scrollbar {
  width: 8px; /* 设置滚动条宽度为15px */
  height: 15px;
}

.timeline-container::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.timeline-container::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 5px;
}

.timeline-container::-webkit-scrollbar-thumb:hover {
  background: #555;
}

/* 添加水平滚动支持 */
.timeline-container.day-view-container {
  overflow-x: auto;
}

/* 三日视图不需要水平滚动 */
.timeline-container.three-day-view-container {
  overflow-x: auto; /* 修改为可滚动，以防内容过宽 */
  min-width: 765px; /* 105px(时间刻度) + 220px*3(三列日期) */
}

/* 一周视图不需要水平滚动 */
.timeline-container.week-view-container {
  overflow-x: auto; /* 修改为可滚动，以防内容过宽 */
  min-width: 850px; /* 105px(时间刻度) + 100px*7(七列日期) */
}

.time-scale {
  width: 105px; /* 60px * 1.75 */
  flex-shrink: 0;
  position: relative;
  background: #f9f9f9;
  border-right: 1.75px solid #ddd; /* 1px * 1.75 */
  height: 100%;
}

.time-hour {
  position: absolute;
  width: 100%;
  padding-right: 8.75px; /* 5px * 1.75 */
  text-align: right;
  border-top: 1.75px solid #ddd; /* 1px * 1.75 */
  font-size: 21px; /* 12px * 1.75 */
  height: 28px; /* 16px * 1.75 */
  line-height: 0;
  user-select: none;
}

.time-minute {
  position: absolute;
  width: 100%;
  padding-right: 8.75px; /* 5px * 1.75 */
  text-align: right;
  border-top: 1.75px dashed #eee; /* 1px * 1.75 */
  font-size: 14px; /* 8px * 1.75 */
  color: #999;
  height: 17.5px; /* 10px * 1.75 */
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
  border-left: 1.75px solid #eee; /* 1px * 1.75 */
  height: 100%;
}

/* 日视图下的列宽度固定 */
.date-column.day-view-column {
  flex: 0 0 525px; /* 300px * 1.75 */
  width: 525px; /* 300px * 1.75 */
}

/* 三日视图下的列宽度固定 */
.date-column.three-day-view-column {
  flex: 0 0 220px; /* 减小宽度以显示全部三列 */
  width: 220px; /* 减小宽度以显示全部三列 */
}

/* 一周视图下的列宽度固定 */
.date-column.week-view-column {
  flex: 0 0 100px; /* 减小宽度以显示全部七列 */
  width: 100px; /* 减小宽度以显示全部七列 */
}

.hour-grid {
  position: absolute;
  left: 0;
  right: 0;
  border-top: 1.75px solid #eee; /* 1px * 1.75 */
}

.task-block {
  position: absolute;
  left: 3.5px; /* 2px * 1.75 */
  right: 3.5px; /* 2px * 1.75 */
  background-color: #4CAF50;
  color: white;
  border-radius: 5.25px; /* 3px * 1.75 */
  padding: 3.5px 7px; /* 2px * 1.75, 4px * 1.75 */
  font-size: 19.25px; /* 11px * 1.75 */
  overflow: hidden;
  cursor: move;
  user-select: none;
  z-index: 10;
  min-height: 28px; /* 16px * 1.75 */
  border: 3.5px solid rgba(255, 255, 255, 0.8); /* 2px * 1.75 */
  box-shadow: 0 0 8.75px rgba(0, 0, 0, 0.2); /* 5px * 1.75 */
  display: flex;
  align-items: center;
  pointer-events: none; /* 允许点击穿透到下方元素 */
  cursor: default;
}

.task-block > * {
  pointer-events: auto; /* 恢复内容区域交互 */
  
}

/* 三日和一周视图下的任务块样式 */
.date-column.three-day-view-column .task-block,
.date-column.week-view-column .task-block {
  min-height: 35px; /* 增大最小高度 */
  padding: 5.25px 10.5px; /* 增大内边距 */
}

.task-block .resize-handle-top {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 12.25px; /* 默认高度 7px * 1.75 */
  cursor: ns-resize;
  z-index: 10; /* 确保拉伸区域始终在上层，可以被选中 */
}

.task-block .resize-handle-top:hover {
  background-color: rgba(255, 255, 255, 0.3); /* 悬停时显示半透明白色背景 */
}

.task-block .resize-handle-bottom {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 12.25px; /* 默认高度 7px * 1.75 */
  cursor: ns-resize;
  z-index: 10; /* 确保拉伸区域始终在上层，可以被选中 */
}

.task-block .resize-handle-bottom:hover {
  background-color: rgba(255, 255, 255, 0.3); /* 悬停时显示半透明白色背景 */
}

.task-block.completed {
  background-color: #9E9E9E;
  border-color: rgba(240, 240, 240, 0.8);
  cursor: not-allowed !important; /* 强制使用禁止指针 */
  opacity: 0.7; /* 更透明 */
}

.task-block:hover {
  box-shadow: 0 1.75px 10.5px rgba(0, 0, 0, 0.5); /* 1px * 1.75, 6px * 1.75 */
  border-color: rgba(255, 255, 255, 1);
}

.task-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 3.5px 0; /* 2px * 1.75 */
  justify-content: center;
  width: 100%;
}

/* 标准模式下的任务内容 - 持续时间≥40分钟 */
.task-content.standard-mode {
  flex-direction: column;
  justify-content: center;
  padding: 3.5px 7px; /* 2px * 1.75, 4px * 1.75 */
}

/* 紧凑模式下的任务内容 - 持续时间<40分钟 */
.task-content.compact-mode {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 0 7px; /* 0, 4px * 1.75 */
}

.task-name {
  font-weight: bold;
  margin-bottom: 3.5px; /* 2px * 1.75 */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 标准模式下的任务名称 */
.task-content.standard-mode .task-name {
  font-size: 19.25px; /* 11px * 1.75 */
  margin-bottom: 5.25px; /* 3px * 1.75 */
}

/* 紧凑模式下的任务名称 */
.task-content.compact-mode .task-name {
  margin-bottom: 0;
  font-size: 17.5px; /* 10px * 1.75 */
  max-width: 65%;
  flex-shrink: 1;
}

.task-time {
  font-size: 17.5px; /* 10px * 1.75 */
  opacity: 0.8;
  white-space: nowrap;
}

/* 标准模式下的时间显示 */
.task-content.standard-mode .task-time {
  font-size: 17.5px; /* 10px * 1.75 */
}

/* 紧凑模式下的时间显示 */
.task-content.compact-mode .task-time {
  font-size: 15.75px; /* 9px * 1.75 */
  margin-left: 7px; /* 4px * 1.75 */
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
  width: 7px; /* 4px * 1.75 */
  background-color: rgba(0, 0, 0, 0.2);
}

.task-block.completed::before {
  background-color: rgba(150, 150, 150, 0.4);
}

.task-form {
  position: fixed;
  background: white;
  border: 1px solid #ddd; /* 1px * 1.75 */
  border-radius: 4px; /* 4px * 1.75 */
  padding: 14px; /* 减小内边距 */
  width: 280px; /* 缩小宽度为左侧区域浮窗大小 */
  box-shadow: 0 3.5px 17.5px rgba(0, 0, 0, 0.1); /* 2px * 1.75, 10px * 1.75 */
  z-index: 1000;
  font-size: 15.75px; /* 稍微缩小字体 */
  max-width: 90vw; /* 确保在小屏幕上也能正常显示 */
}

.form-header {
  border-bottom: 1.75px solid #eee; /* 1px * 1.75 */
  margin-bottom: 14px; /* 减小边距 */
}

.form-header h3 {
  margin: 0;
  padding: 0 0 14px 0; /* 减小内边距 */
  font-size: 19.25px; /* 稍微缩小标题字体 */
}

.form-group {
  margin-bottom: 14px; /* 减小边距 */
}

.form-group label {
  display: block;
  margin-bottom: 7px; /* 减小边距 */
  font-size: 15.75px; /* 保持字体大小一致 */
}

.form-group input {
  width: 100%;
  padding: 8.75px; /* 减小内边距 */
  border: 1.75px solid #ddd; /* 1px * 1.75 */
  border-radius: 7px; /* 4px * 1.75 */
  font-size: 15.75px; /* 保持字体大小一致 */
}

.form-footer {
  display: flex;
  justify-content: flex-end;
  gap: 14px; /* 减小间距 */
  margin-top: 14px; /* 减小边距 */
}

.form-footer button {
  padding: 8.75px 17.5px; /* 减小内边距 */
  border: 1.75px solid #ddd; /* 1px * 1.75 */
  background: #f5f5f5;
  cursor: pointer;
  border-radius: 7px; /* 4px * 1.75 */
  font-size: 15.75px; /* 保持字体大小一致 */
}

.form-footer button.primary {
  background: #4CAF50;
  color: white;
  border-color: #43A047;
}

.task-menu {
  position: fixed;
  background: white;
  border: 1.75px solid #ddd; /* 1px * 1.75 */
  border-radius: 7px; /* 4px * 1.75 */
  box-shadow: 0 3.5px 17.5px rgba(0, 0, 0, 0.1); /* 2px * 1.75, 10px * 1.75 */
  z-index: 1000;
  overflow: hidden;
  font-size: 15.75px; /* 保持字体大小一致 */
  width: 140px; /* 缩小宽度 */
  pointer-events: auto; /* 允许菜单交互 */
}

.menu-item {
  padding: 10.5px 17.5px; /* 减小内边距 */
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
  font-size: 15.75px; /* 9px * 1.75 */
  margin: 0;
  padding: 0;
  line-height: 1;
  text-align: center;
  max-width: 100%;
}

/* 添加隐藏时间的样式 */
.task-content.hide-time {
  padding: 0;
  justify-content: center;
  height: 100%;
  display: flex;
  align-items: center;
  flex-direction: column; /* 改为垂直布局 */
}

.task-content.hide-time .task-name {
  margin: 0;
  font-size: 17.5px; /* 增大字体大小 */
  text-align: center;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: normal; /* 允许换行 */
  padding: 0 3.5px; /* 添加水平内边距 */
  line-height: 1.2; /* 调整行高 */
  max-height: 2.4em; /* 限制为两行 */
  display: -webkit-box;
  -webkit-line-clamp: 2; /* 限制为两行 */
  -webkit-box-orient: vertical;
  line-clamp: 2; /* 添加标准属性 */
  display: -moz-box;
  -moz-line-clamp: 2; /* Firefox支持 */
  display: box;
  box-orient: vertical;
}

/* 三日视图下的任务名称 */
.date-column.three-day-view-column .task-content.hide-time .task-name {
  max-width: 180px; /* 调整宽度以适应更窄的列 */
}

/* 一周视图下的任务名称 */
.date-column.week-view-column .task-content.hide-time .task-name {
  max-width: 85px; /* 调整宽度以适应更窄的列 */
  max-height: 3.6em; /* 限制为三行 */
  -webkit-line-clamp: 3; /* 限制为三行 */
  line-clamp: 3; /* 添加标准属性 */
  -moz-line-clamp: 3; /* Firefox支持 */
  font-size: 15.75px; /* 略微减小字体大小 */
}

/* 高亮当日日期列 */
.date-column.today-column {
  background-color: rgba(135, 206, 250, 0.15); /* 浅蓝色，半透明 */
}

.date-header.today-column {
  background-color: rgba(135, 206, 250, 0.15); /* 浅蓝色，半透明 */
}

/* 当前时间线样式 */
.current-time-line {
  position: absolute;
  left: 0;
  right: 0;
  height: 1px; /* 降低粗细到一半 */
  background-color: #ff0000; /* 红色 */
  z-index: 9999; /* 确保在最顶层 */
  pointer-events: none; /* 避免干扰鼠标事件 */
}

.current-time-label {
  position: absolute;
  left: 0;
  top: -10px;
  background-color: #ff0000;
  color: white;
  padding: 0 5px;
  font-size: 12px;
  border-radius: 2px;
  z-index: 9999; /* 确保在最顶层 */
}

/* 拖拽时间指示器样式 */
:global(.drag-time-indicator) {
  position: fixed;
  left: 105px;
  padding: 2px 6px;
  background-color: rgba(0, 120, 255, 0.8);
  color: white;
  border-radius: 3px;
  font-size: 12px;
  pointer-events: none;
  z-index: 9999;
}

/* 拉伸时间指示器样式 */
:global(.resize-time-indicator) {
  position: fixed;
  left: 105px;
  padding: 2px 6px;
  background-color: rgba(0, 120, 255, 0.8);
  color: white;
  border-radius: 3px;
  font-size: 12px;
  pointer-events: none;
  z-index: 9999;
}

/* 鼠标悬停时间线样式 */
.hover-time-line {
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  background-color: #4dabf5; /* 浅蓝色 */
  z-index: 500; /* 确保在大多数元素上方，但低于时间线和浮窗 */
  pointer-events: none; /* 避免干扰鼠标事件 */
}

.hover-time-label {
  position: absolute;
  left: 0;
  top: -10px;
  background-color: #4dabf5;
  color: white;
  padding: 0 5px;
  font-size: 12px;
  border-radius: 2px;
  z-index: 500;
}
</style> 