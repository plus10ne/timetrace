<template>
  <div class="app-container">
    <!-- 左侧栏目 -->
    <div class="left-panel">
      <Todo 
        :todos="todos" 
        :selected-date="selectedDate"
        @add-todo="addTodo" 
        @toggle-task="toggleTaskStatus" 
        @rename-todo="renameTodo"
        @delete-todo="deleteTodo"
        @edit-todo="editTodo"
        @update-todo="updateTodoWithTime"
      />
    </div>

    <!-- 右侧栏目 -->
    <div class="right-panel">
      <TimeSchedule 
        :todos="todos" 
        @add-task="addTask" 
        @update-task="updateTask" 
        @update-task-time="updateTaskTime" 
        @complete-task="completeTask" 
        @delete-task="deleteTask" 
        @schedule-task="scheduleTask" 
      />
    </div>
  </div>
</template>

<script>
import { ref, onMounted, toRaw } from 'vue'
import dayjs from 'dayjs'
import isBetween from 'dayjs/plugin/isBetween'
dayjs.extend(isBetween) // 扩展插件
import Todo from '@/components/Todo.vue'
import TimeSchedule from '@/components/TimeSchedule.vue'
import {
  getAllTodos,
  addTodo as dbAddTodo,
  updateTodo as dbUpdateTodo,
  deleteTodo as dbDeleteTodo
} from '@/utils/db.js'

export default {
  name: 'App',
  components: { Todo, TimeSchedule },
  data(){
    return{
      todos:[],
      selectedDate: new Date()
    }
  },
  setup() {
    const todos = ref([])

    // 初始化：加载所有待办事项并清理过期
    onMounted(async () => {
      todos.value = (await getAllTodos()) || []
      cleanupOldTasks()
    })

    // 清理超过一周的任务
    function cleanupOldTasks() {
      const cutoff = dayjs().subtract(7, 'day').format('YYYY-MM-DD')
      todos.value = todos.value.filter(t => !t.date || t.date >= cutoff)
    }

    /**
     * 添加新待办：写入数据库并更新本地
     */
    async function addTodo(todo) {
      todo.date = dayjs().format('YYYY-MM-DD')
      await dbAddTodo(todo)
      todos.value.push(todo)
    }

    /**
     * 时间轴新增任务，同步数据库
     */
    async function addTask(task) {
      if (!task.date) task.date = dayjs().format('YYYY-MM-DD')
      await dbAddTodo(task)
      todos.value.push(task)
    }

    /**
     * 更新任务
     */
    async function updateTask(updated) {
      if (updated.completed && !updated.completedAt) {
        updated.completedAt = dayjs().format()
      }
      // 脱 Proxy 以后再存
      const raw = toRaw(updated)
      await dbUpdateTodo(raw)
      const idx = todos.value.findIndex(t => t.id === updated.id)
      if (idx !== -1) {
        todos.value[idx] = { ...todos.value[idx], ...updated }
      }
    }

    /**
     * 仅更新时间
     */
    async function updateTaskTime(task) {
      const idx = todos.value.findIndex(t => t.id === task.id)
      if (idx === -1) return
      todos.value[idx].startTime = task.startTime
      todos.value[idx].endTime = task.endTime
      todos.value[idx].duration = task.duration
      await dbUpdateTodo(todos.value[idx])
    }

    /**
     * 完成/取消完成任务
     */
    async function completeTask(task) {
      const idx = todos.value.findIndex(t => t.id === task.id)
      if (idx === -1) return
      const updated = { ...todos.value[idx], completed: !todos.value[idx].completed }
      updated.completedAt = updated.completed ? dayjs().format() : null
      updated.isOnTimeline = true

      await dbUpdateTodo(updated)
      todos.value[idx] = updated
    }

    /**
     * 时间表删除任务：重置时间与状态
     */
    async function deleteTask(task) {
      const idx = todos.value.findIndex(t => t.id === task.id)
      if (idx === -1) return

      // 移除时间轴显示
      todos.value[idx].isOnTimeline = false

      //toRaw 拿到普通 JS 对象再存
      const raw = toRaw(todos.value[idx])
      await dbUpdateTodo(raw)
    }

    /**
     * 安排到日程
     */
    async function scheduleTask(task) {
      const idx = todos.value.findIndex(t => t.id === task.id)
      if (idx === -1) return

      // 标记此任务已在时间轴上
      todos.value[idx].isOnTimeline = true;

      // 只更新这几个字段，保持其他字段（尤其是 duration）不变
      const updated = {
        ...todos.value[idx],
        date: task.date,
        startTime: task.startTime,
        endTime:   task.endTime,
        isOnTimeline: true
      }
      
      // 拿到纯 JS 对象存 db
      await dbUpdateTodo(toRaw(updated))
      todos.value[idx] = updated
    }

    /**
     * 左侧切换完成
     */
    async function toggleTaskStatus(task) {
      const idx = todos.value.findIndex(t => t.id === task.id)
      if (idx === -1) return
      const updated = { 
        ...todos.value[idx],
        isOnTimeline: true,
      }

      //updated.completed = !updated.completed
      //updated.completedAt = updated.completed ? now.toISOString() : null
      //if (updated.completed && !updated.startTime) {
      //  const hh = now.getHours().toString().padStart(2, '0')
      //  const mm = now.getMinutes().toString().padStart(2, '0')
      //  updated.startTime = `${hh}:${mm}`
      //  const end = new Date(now.getTime() + 30*60000)
      //  updated.endTime = `${end.getHours().toString().padStart(2,'0')}:${end
      //    .getMinutes().toString().padStart(2,'0')}`
      //}
      await dbUpdateTodo(toRaw(updated))
      todos.value[idx] = updated
    }

    /**
     * 重命名待办
     */
    async function renameTodo({ id, name }) {
      const idx = todos.value.findIndex(t => t.id === id)
      if (idx === -1) return
      const updated = { ...todos.value[idx], name }
      await dbUpdateTodo(updated)
      todos.value[idx].name = name
    }

    /**
     * 删除左侧待办
     */
    async function deleteTodo({ id }) {
      await dbDeleteTodo(id)
      todos.value = todos.value.filter(t => t.id !== id)
    }

    /**
     * 编辑左侧待办（时间）
     */
    async function editTodo(task) {
      const idx = todos.value.findIndex(t => t.id === task.id)
      if (idx === -1) return
      if (!task.startTime || !task.endTime) {
        const now = new Date()
        const hh = now.getHours().toString().padStart(2,'0')
        const mm = now.getMinutes().toString().padStart(2,'0')
        todos.value[idx].startTime = `${hh}:${mm}`
        const end = new Date(now.getTime() + 30*60000)
        todos.value[idx].endTime = `${end.getHours().toString().padStart(2,'0')}:${end
          .getMinutes().toString().padStart(2,'0')}`
      }
      await dbUpdateTodo(todos.value[idx])
    }

    /**
     * 更新包括时间在内的完整记录
     */
    async function updateTodoWithTime(updatedTodo) {
      const idx = todos.value.findIndex(t => t.id === updatedTodo.id)
      if (idx === -1) return
      updatedTodo.date ||= dayjs().format('YYYY-MM-DD')
      ['startTime','endTime'].forEach(key => {
        if (updatedTodo[key] && !/^\d{2}:\d{2}$/.test(updatedTodo[key])) {
          const [h,m] = updatedTodo[key].split(':')
          updatedTodo[key] = `${h.padStart(2,'0')}:${m.padStart(2,'0')}`
        }
      })
      todos.value[idx] = { ...todos.value[idx], ...updatedTodo }
      await dbUpdateTodo(todos.value[idx])
    }

    return {
      todos,
      addTodo,
      addTask,
      updateTask,
      updateTaskTime,
      completeTask,
      deleteTask,
      scheduleTask,
      toggleTaskStatus,
      renameTodo,
      deleteTodo,
      editTodo,
      updateTodoWithTime
    }
  }
}
</script>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  color: #333;
  line-height: 1.4;
  height: 100vh;
  overflow: hidden;
}

.app-container {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

.left-panel {
  width: 30%;
  min-width: 300px;
  border-right: 1px solid #e0e0e0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 10px;
}

.right-panel {
  width: 70%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 10px;
}

button {
  cursor: pointer;
}

button:hover {
  opacity: 0.9;
}

input:focus, button:focus {
  outline: none;
}

</style>
