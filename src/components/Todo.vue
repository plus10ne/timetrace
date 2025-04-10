<template>
  <div class="todo-container">
    <!-- 待办区域 -->
    <div class="pending-tasks">
      <h3>待办区域</h3>
      <div class="add-todo">
        <input 
          type="text" 
          v-model="newTodo" 
          placeholder="添加每日待办..." 
          @keyup.enter="addTodo" 
        />
        <button @click="addTodo">添加</button>
      </div>
      <ul>
        <li
          v-for="item in pendingTodos"
          :key="item.id"
          :class="{ completed: item.completed }"
          draggable="true"
          @dragstart="onDragStart(item, $event)"
          @click.self="openTodoMenu($event, item)"
        >
          <input 
            type="checkbox" 
            :checked="item.completed" 
            @change="toggleTask(item)" 
          />
          <span 
            v-if="editingTodoId !== item.id" 
            @click="startRenaming(item)"
            class="todo-name"
          >{{ item.name }}</span>
          <div 
            v-else
            class="rename-container"
          >
            <input 
              type="text"
              class="rename-input"
              v-model="editingTodoName"
              @keyup.enter="finishRenaming"
              @blur="finishRenaming"
              ref="renameInput"
              @click.stop
              :style="{ minWidth: editingNameWidth + 'px' }"
            />
          </div>
        </li>
      </ul>
    </div>
    <!-- 已完成区域 -->
    <div class="completed-tasks">
      <h3>已完成</h3>
      <ul>
        <li 
          v-for="item in completedTodos" 
          :key="item.id"
          @click.self="openTodoMenu($event, item)"
        >
          <input 
            type="checkbox" 
            checked 
            @change="toggleTask(item)" 
          />
          <span 
            @click="startRenaming(item)"
            class="todo-name"
          >{{ item.name }}</span>
          <span class="task-time">
            完成于: {{ formatTime(item.completedAt) }}
          </span>
        </li>
      </ul>
    </div>

    <!-- 待办菜单浮窗 -->
    <div 
      v-if="showTodoMenu" 
      class="todo-menu"
      :style="{ top: `${menuPosition.y}px`, left: `${menuPosition.x}px` }"
    >
      <div @click="toggleSelectedTodo" class="menu-item">{{ selectedTodo && selectedTodo.completed ? '取消完成' : '完成' }}</div>
      <div @click="editSelectedTodo" class="menu-item">编辑</div>
      <div @click="deleteSelectedTodo" class="menu-item delete">删除</div>
    </div>

    <!-- 任务编辑表单浮窗 -->
    <div 
      v-if="showTaskForm" 
      class="task-form"
      :style="{ top: `${formPosition.y}px`, left: `${formPosition.x}px` }"
      @click.stop
      @mousedown.stop
    >
      <div class="form-header">
        <h4>编辑待办事项</h4>
        <button class="close-button" @click.stop="cancelTaskForm">×</button>
      </div>
      <div class="form-group">
        <label>待办名称</label>
        <input 
          type="text" 
          v-model="editingTask.name" 
          placeholder="待办名称"
          @click.stop 
        />
      </div>
      <div class="form-group">
        <label>开始时间</label>
        <input 
          type="time" 
          v-model="editingTask.startTime"
          @click.stop 
        />
      </div>
      <div class="form-group">
        <label>结束时间</label>
        <input 
          type="time" 
          v-model="editingTask.endTime"
          @click.stop 
        />
      </div>
      <div class="form-actions">
        <button @click.stop="saveTask" class="save-button">确定</button>
        <button @click.stop="cancelTaskForm" class="cancel-button">取消</button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'TodoList',
  props: {
    todos: {
      type: Array,
      required: true
    }
  },
  data() {
    return {
      newTodo: '',
      editingTodoId: null,
      editingTodoName: '',
      showTodoMenu: false,
      selectedTodo: null,
      menuPosition: { x: 0, y: 0 },
      editingNameWidth: 0,
      // 新增的数据属性
      showTaskForm: false,
      editingTask: {
        id: null,
        name: '',
        startTime: '',
        endTime: '',
        completed: false,
        completedAt: null
      },
      formPosition: { x: 0, y: 0 }
    }
  },
  computed: {
    pendingTodos() {
      return this.todos.filter(t => !t.completed);
    },
    completedTodos() {
      return this.todos
        .filter(t => t.completed)
        .sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt));
    }
  },
  mounted() {
    // 添加全局点击事件监听，用于关闭菜单
    document.addEventListener('click', this.closeMenus);
  },
  beforeUnmount() {
    // 移除全局点击事件监听
    document.removeEventListener('click', this.closeMenus);
  },
  methods: {
    addTodo() {
      if (this.newTodo.trim()) {
        this.$emit('add-todo', {
          id: Date.now(),
          name: this.newTodo,
          startTime: '',
          endTime: '',
          completed: false,
          completedAt: null
        });
        this.newTodo = '';
      }
    },
    toggleTask(task) {
      this.$emit('toggle-task', task);
    },
    onDragStart(task, event) {
      // 关闭任何打开的菜单
      this.showTodoMenu = false;
      
      event.dataTransfer.setData('taskId', task.id.toString());
      event.dataTransfer.setData('taskData', JSON.stringify(task));
    },
    formatTime(timestamp) {
      if (!timestamp) return '';
      const date = new Date(timestamp);
      return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    },
    
    // 开始重命名待办
    startRenaming(todo) {
      this.showTodoMenu = false; // 关闭菜单
      this.editingTodoId = todo.id;
      this.editingTodoName = todo.name;
      
      // 根据待办名称长度估算输入框宽度
      // 每个字符大约10px，最小宽度为80px
      this.editingNameWidth = Math.max(todo.name.length * 10, 80);
      
      this.$nextTick(() => {
        if (this.$refs.renameInput) {
          this.$refs.renameInput.focus();
          this.$refs.renameInput.select(); // 选中全部文本
        }
      });
    },
    
    // 完成重命名
    finishRenaming() {
      if (this.editingTodoId !== null) {
        if (this.editingTodoName.trim()) {
          // 发出重命名事件
          this.$emit('rename-todo', {
            id: this.editingTodoId,
            name: this.editingTodoName.trim()
          });
        }
        this.editingTodoId = null;
        this.editingTodoName = '';
      }
    },
    
    // 打开待办菜单
    openTodoMenu(event, todo) {
      // 设置选中的待办并显示待办操作菜单
      this.selectedTodo = todo;
      this.menuPosition = {
        x: event.clientX,
        y: event.clientY
      };
      this.showTodoMenu = true;
      event.stopPropagation(); // 阻止冒泡
    },
    
    // 关闭菜单
    closeMenus(event) {
      // 如果点击是在菜单之外的地方，则关闭菜单
      if (this.showTodoMenu && !event.target.closest('.todo-menu')) {
        this.showTodoMenu = false;
      }
      
      // 如果点击是在表单之外的地方，并且不是编辑按钮，则关闭表单
      if (this.showTaskForm && !event.target.closest('.task-form') && 
          !event.target.closest('.menu-item')) {
        this.showTaskForm = false;
      }
    },
    
    // 切换选中待办的完成状态
    toggleSelectedTodo() {
      if (this.selectedTodo) {
        this.toggleTask(this.selectedTodo);
        this.showTodoMenu = false;
      }
    },
    
    // 编辑选中的待办
    editSelectedTodo() {
      if (this.selectedTodo) {
        // 修改为打开编辑表单而不是直接发送编辑事件
        this.openTaskForm(this.menuPosition, this.selectedTodo);
        this.showTodoMenu = false;
      }
    },
    
    // 删除选中的待办
    deleteSelectedTodo() {
      if (this.selectedTodo) {
        this.$emit('delete-todo', this.selectedTodo);
        this.showTodoMenu = false;
      }
    },
    
    // 打开任务编辑表单
    openTaskForm(position, task) {
      // 克隆任务对象，确保不直接修改原对象
      this.editingTask = { ...task };
      
      // 调整表单位置，确保在视口内可见
      this.formPosition = {
        x: Math.min(position.x, window.innerWidth - 300),
        y: Math.min(position.y, window.innerHeight - 300)
      };
      
      // 设置表单可见
      this.showTaskForm = true;
      
      // 添加控制台日志以便于调试
      console.log("打开编辑表单", this.showTaskForm, this.editingTask);
    },
    
    // 保存编辑后的任务
    saveTask() {
      if (!this.editingTask.name.trim()) {
        this.editingTask.name = '新待办';
      }
      
      // 如果任务存在ID，表示是编辑已有任务
      if (this.editingTask.id) {
        // 确保有日期字段
        if (!this.editingTask.date) {
          this.editingTask.date = new Date().toISOString().split('T')[0];
        }
        
        console.log("保存编辑的任务", this.editingTask);
        this.$emit('update-todo', this.editingTask);
      }
      
      this.showTaskForm = false;
    },
    
    // 取消编辑表单
    cancelTaskForm() {
      this.showTaskForm = false;
    }
  }
}
</script>

<style scoped>
.todo-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  position: relative;
}

.pending-tasks {
  flex: 1;
  overflow-y: auto;
  margin-bottom: 10px;
  max-height: 50%;
}

.completed-tasks {
  flex: 1;
  overflow-y: auto;
  border-top: 1px solid #eee;
  padding-top: 10px;
  max-height: 50%;
}

h3 {
  margin-top: 0;
  padding: 10px 0;
}

.add-todo {
  display: flex;
  margin-bottom: 15px;
}

.add-todo input {
  flex: 1;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px 0 0 4px;
}

.add-todo button {
  padding: 8px 15px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 0 4px 4px 0;
  cursor: pointer;
}

ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

li {
  display: flex;
  align-items: center;
  padding: 8px;
  border-bottom: 1px solid #f0f0f0;
  transition: background-color 0.2s;
  width: 100%;
}

li:hover {
  background-color: #f9f9f9;
}

li input[type="checkbox"] {
  margin-right: 10px;
  flex-shrink: 0;
}

/* 待办项名称样式 */
.todo-name {
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 3px;
  flex: none; /* 不再使用 flex 拉伸，让内容决定宽度 */
  text-align: left;
  display: inline-block;
  white-space: normal;
  word-break: break-word;
  margin-right: auto; /* 将剩余空间推到右侧 */
}

.todo-name:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

li.completed .todo-name {
  color: #999;
  text-decoration: line-through;
}

.task-time {
  margin-left: auto;
  font-size: 0.8em;
  color: #888;
  flex-shrink: 0; /* 防止时间被压缩 */
}

/* 重命名容器 */
.rename-container {
  margin-right: auto;
  display: inline-block;
}

/* 重命名输入框样式 */
.rename-input {
  padding: 4px 8px;
  border: 1px solid #4CAF50;
  border-radius: 3px;
  font-size: 14px;
  width: auto; /* 根据内容自动调整宽度 */
}

/* 待办菜单样式 */
.todo-menu {
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

/* 任务编辑表单样式 */
.task-form {
  position: fixed;
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 3px 15px rgba(0, 0, 0, 0.3);
  z-index: 1001;
  width: 280px;
  padding: 15px;
  overflow: hidden;
}

.form-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  border-bottom: 1px solid #f0f0f0;
  padding-bottom: 10px;
}

.form-header h4 {
  margin: 0;
  font-size: 16px;
  color: #333;
}

.close-button {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  padding: 0 5px;
  color: #666;
}

.close-button:hover {
  color: #f44336;
}

.form-group {
  margin-bottom: 12px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  color: #666;
  font-size: 14px;
}

.form-group input {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 15px;
}

.save-button {
  padding: 8px 15px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-left: 10px;
}

.save-button:hover {
  background-color: #45a049;
}

.cancel-button {
  padding: 8px 15px;
  background-color: #f5f5f5;
  color: #333;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
}

.cancel-button:hover {
  background-color: #e0e0e0;
}
</style> 