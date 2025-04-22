<template>
  <div class="todo-container">
    <!-- 待办区域 -->
    <div class="pending-tasks">
      <h3>待办区域（{{ formatHeaderDate(selectedDate) }}）</h3>
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
          <div v-else class="rename-container">
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
      <h3>已完成（{{ formatHeaderDate(selectedDate) }}）</h3>
      <ul>
        <li
          v-for="item in completedTodos"
          :key="item.id"
          @click.self="openTodoMenu($event, item)"
        >
          <input
            type="checkbox"
            :checked="item.completed"
            @change="toggleTask(item)"
          />
          <span @click="startRenaming(item)" class="todo-name">{{ item.name }}</span>
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
      <div @click="onMenuToggle()" class="menu-item">
        {{ selectedTodo && selectedTodo.completed ? '取消完成' : '完成' }}
      </div>
      <div @click="onMenuEdit()" class="menu-item">编辑</div>
      <div @click="onMenuDelete()" class="menu-item delete">删除</div>
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
import dayjs from 'dayjs'
import isBetween from 'dayjs/plugin/isBetween'
dayjs.extend(isBetween) // 扩展插件
import {
  addTodo as dbAddTodo,
  getAllTodos,
  updateTodo as dbUpdateTodo,
  deleteTodo as dbDeleteTodo
} from '../utils/db'

export default {
  name: 'TodoList',
  props:{
    todos:{
      type: Array,
      required: true,
      default: () => []  // 添加默认空数组
    },
    selectedDate: {
      type: [Date, String],
      required: true
    }
  },
   data() {
     return {
       //todos: [],                // 所有待办
       newTodo: '',               // 输入框内容
       editingTodoId: null,       // 重命名时的 ID
       editingTodoName: '',       // 重命名时的内容
       showTodoMenu: false,       // 是否显示菜单
       selectedTodo: null,        // 菜单作用的待办
       isOnTimeline: false,
       menuPosition: { x: 0, y: 0 },
       editingNameWidth: 0,       // 重命名输入宽度
       showTaskForm: false,       // 是否显示表单
       editingTask: {             // 编辑表单绑定数据
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
    // 未完成任务列表
    pendingTodos() {
      // 添加空值检查
      if (!Array.isArray(this.todos)) return []

      const date = dayjs(this.selectedDate)
      const dayStart = date.startOf('day')
      const dayEnd = date.endOf('day')

      return this.todos.filter(t => 
        !t.completed && 
        dayjs(t.createdAt).isBetween(dayStart, dayEnd, null, '[]')
      )
    },
    // 完成任务列表，按完成时间排序
    completedTodos() {
      // 添加空值检查
      if (!Array.isArray(this.todos)) return []

      const date = dayjs(this.selectedDate)
      const dayStart = date.startOf('day')
      const dayEnd = date.endOf('day')

      return this.todos
        .filter(t => 
            t.completed && 
            dayjs(t.completedAt).isBetween(dayStart, dayEnd, null, '[]')
          )
        .sort((a,b) => new Date(a.completedAt) - new Date(b.completedAt))

    }
  },
  mounted() {
    // 全局监听
    document.addEventListener('click', this.closeMenus)
    document.addEventListener('mousedown', this.closeMenus)
    document.addEventListener('keydown', this.handleKeyDown)
  },
  beforeUnmount() {
    document.removeEventListener('click', this.closeMenus)
    document.removeEventListener('mousedown', this.closeMenus)
    document.removeEventListener('keydown', this.handleKeyDown)
  },
  methods: {
    formatHeaderDate(date) {
      return dayjs(date).format('YYYY-MM-DD')
    },
    handleKeyDown(e) {
      if (e.key === 'Escape') {
        this.editingTodoId = null
        this.showTaskForm = false
        this.showTodoMenu = false
      }
    },
    /**
     * 新建待办
     * 1) 写入数据库
     * 2) 推入本地列表
     */
    addTodo() {
      const name = this.newTodo.trim()
      if (!name) return
      const id = `${Date.now()}-${Math.floor(Math.random() * 10000)}`
      const task = { 
        id, 
        name, 
        startTime: '', 
        endTime: '', 
        duration: 30, 
        completed: false, 
        completedAt: null,
        createdAt: dayjs().format(), // 新增创建时间
        isOnTimeline: false,
      }
      // 发给父组件真正去写库并更新 todos 列表
      this.$emit('add-todo', task)

      //清空输入框
      this.newTodo = ''
    },

    /**
     * 菜单：切换完成状态
     * 完成后自动关闭菜单
     */
    async onMenuToggle() {
      if (!this.selectedTodo) return
      await this.toggleTask(this.selectedTodo)
      this.showTodoMenu = false
      this.selectedTodo = null
    },

    /**
     * 菜单：编辑待办
     * 打开表单并关闭菜单
     */
    onMenuEdit() {
      if (!this.selectedTodo) return
      this.showTodoMenu = false
      this.editSelectedTodo()
    },

    /**
     * 菜单：删除待办
     * 删除后自动关闭菜单
     */
    async onMenuDelete() {
      if (!this.selectedTodo) return
      await this.deleteSelectedTodo()
    },

    /**
     * 删除选中的待办
     */
    deleteSelectedTodo() {
      // if (!this.selectedTodo) return
      // await dbDeleteTodo(this.selectedTodo.id)
      // this.todos = this.todos.filter(t => t.id !== this.selectedTodo.id)
      // this.selectedTodo = null
      // this.showTodoMenu = false
      this.showTodoMenu = false
      this.$emit('delete-todo', this.selectedTodo)
    },

    /**
     * 切换完成状态
     * 直接修改数组元素以触发响应式
     */
    toggleTask(task) {
      // const idx = this.todos.findIndex(t => t.id === task.id)
      // if (idx === -1) return
      // const updated = { ...this.todos[idx] }
      // updated.completed = !updated.completed
      // updated.completedAt = updated.completed ? dayjs().format() : null
      // await dbUpdateTodo(updated)
      // this.todos[idx] = updated
      
      task.completed = !task.completed
      this.$emit('toggle-task', task)
    },

    /** 开始重命名 */
    startRenaming(todo) {
      this.showTodoMenu = false
      this.editingTodoId = todo.id
      this.editingTodoName = todo.name
      this.editingNameWidth = Math.max(todo.name.length * 10, 80)
      this.$nextTick(() => this.$refs.renameInput?.focus())
    },

    /** 完成重命名 */
    finishRenaming() {
      // if (!this.editingTodoId) return
      // const idx = this.todos.findIndex(t => t.id === this.editingTodoId)
      // if (idx !== -1 && this.editingTodoName.trim()) {
      //   const updated = { ...this.todos[idx], name: this.editingTodoName.trim() }
      //   await dbUpdateTodo(updated)
      //   this.todos[idx] = updated
      // }
      // this.editingTodoId = null
      // this.editingTodoName = ''
        this.$emit('rename-todo', {
        id: this.editingTodoId,
        name: this.editingTodoName.trim()
      })
      this.editingTodoId = null
    },

    /** 打开菜单 */
    openTodoMenu(event, todo) {
      this.selectedTodo = todo
      this.menuPosition = { x: event.clientX, y: event.clientY }
      this.showTodoMenu = true
      event.stopPropagation()
    },

    /** 点击空白区域关闭菜单或表单 */
    closeMenus(event) {
      if (this.showTodoMenu && !event.target.closest('.todo-menu')) this.showTodoMenu = false
      if (this.showTaskForm && !event.target.closest('.task-form') && !event.target.closest('.menu-item'))
        this.showTaskForm = false
    },

    /** 打开编辑表单 */
    editSelectedTodo() {
      this.editingTask = { ...this.selectedTodo }
      this.formPosition = { ...this.menuPosition }
      this.showTaskForm = true
    },

    /** 取消编辑表单 */
    cancelTaskForm() {
      this.showTaskForm = false
      this.editingTask = { id: null, name: '', startTime: '', endTime: '', completed: false, completedAt: null }
    },

    /** 保存编辑后的任务 */
    async saveTask() {
      if (!this.editingTask.name.trim()) return
      const updated = { ...this.editingTask }
      await dbUpdateTodo(updated)
      const idx = this.todos.findIndex(t => t.id === updated.id)
      if (idx !== -1) this.todos[idx] = updated
      this.cancelTaskForm()
    },

    /** 拖拽开始 */
    onDragStart(task, event) {
      // 关闭任何打开的菜单
      this.showTodoMenu = false
      this.showTaskForm = false

      const offsetY = event.offsetY

      event.dataTransfer.setData('taskId',     task.id.toString())
      event.dataTransfer.setData('offsetY',   offsetY.toString())
      event.dataTransfer.setData('taskData',  JSON.stringify(task))

      // 标记这次要做“移动”操作
      event.dataTransfer.effectAllowed = 'move'
      console.log('开始拖拽任务:', task.id, task.name)
    },

    /** 时间格式化 */
    formatTime(ts) {
      if (!ts) return ''
      const d = new Date(ts)
      return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
    }
  }
}
</script>

<style scoped>
.todo-container {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 60px); /* 根据实际布局调整 */
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
  flex: 1 1 50%;
  overflow-y: auto;
  border-top: 1px solid #eee;
  padding-top: 10px;
  max-height: 50%;
  min-height: 200px; /* 确保最小高度 */
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