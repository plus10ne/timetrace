<template>
  <div class="app-container">
    <!-- 左侧栏目 -->
    <div class="left-panel">
      <Todo 
        :todos="todos" 
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
import { ref } from 'vue'
import Todo from './components/Todo.vue'
import TimeSchedule from './components/TimeSchedule.vue'
import dayjs from 'dayjs'

export default {
  name: 'App',
  components: {
    Todo,
    TimeSchedule
  },
  setup() {
    // 所有待办数据
    const todos = ref([
      {
        id: 1,
        name: '编写周报',
        date: dayjs().format('YYYY-MM-DD'),
        startTime: '09:00',
        endTime: '10:00',
        completed: false,
        completedAt: null
      },
      {
        id: 2,
        name: '产品',
        date: dayjs().format('YYYY-MM-DD'),
        startTime: '10:30',
        endTime: '11:30',
        completed: true,
        completedAt: '2023-04-09T11:30:00'
      },
      {
        id: 3,
        name: '午餐',
        date: dayjs().format('YYYY-MM-DD'),
        startTime: '12:00',
        endTime: '13:00',
      completed: false,
      completedAt: null
      }
    ]);

    // 清理过期待办，只保留一周内的记录
    const cleanupOldTasks = () => {
      const weekAgo = dayjs().subtract(7, 'day').format('YYYY-MM-DD');
      todos.value = todos.value.filter(task => {
        // 没有日期的任务或近一周的任务保留
        return !task.date || task.date >= weekAgo;
      });
    };

    // 首次加载时清理过期任务
    cleanupOldTasks();

    // 添加待办（从左侧添加）
    const addTodo = (todo) => {
      // 设置当前日期
      todo.date = dayjs().format('YYYY-MM-DD');
      todos.value.push(todo);
    };

    // 添加待办（从右侧时间轴添加）
    const addTask = (task) => {
      // 确保任务有日期
      if (!task.date) {
        task.date = dayjs().format('YYYY-MM-DD');
      }
      todos.value.push(task);
    };

    // 更新待办
    const updateTask = (updatedTask) => {
      const index = todos.value.findIndex(t => t.id === updatedTask.id);
      if (index !== -1) {
        todos.value[index] = { ...todos.value[index], ...updatedTask };
      }
    };

    // 更新待办时间（调整大小时触发）
    const updateTaskTime = (task) => {
      const index = todos.value.findIndex(t => t.id === task.id);
      if (index !== -1) {
        todos.value[index].startTime = task.startTime;
        todos.value[index].endTime = task.endTime;
      }
    };

    // 完成待办
    const completeTask = (task) => {
      const index = todos.value.findIndex(t => t.id === task.id);
      if (index !== -1) {
        // 切换任务的完成状态
        const taskCompleted = !todos.value[index].completed;
        todos.value[index].completed = taskCompleted;
        
        if (taskCompleted) {
          // 标记为完成
          todos.value[index].completedAt = new Date().toISOString();
        } else {
          // 取消完成状态
          todos.value[index].completedAt = null;
        }
      }
    };

    // 删除待办（仅在右侧删除，不影响左侧）
    const deleteTask = (task) => {
      const index = todos.value.findIndex(t => t.id === task.id);
      if (index !== -1) {
        // 仅重置时间信息，不删除任务
        todos.value[index].startTime = '';
        todos.value[index].endTime = '';
        
        // 如果任务处于完成状态，将其重置为未完成状态
        if (todos.value[index].completed) {
          todos.value[index].completed = false;
          todos.value[index].completedAt = null;
        }
      }
    };

    // 安排待办（从左侧拖拽到右侧时触发）
    const scheduleTask = (task) => {
      const index = todos.value.findIndex(t => t.id === task.id);
      if (index !== -1) {
        todos.value[index].date = task.date;
        todos.value[index].startTime = task.startTime;
        todos.value[index].endTime = task.endTime;
      }
    };

    // 切换待办状态（左侧勾选时触发）
    const toggleTaskStatus = (task) => {
      const index = todos.value.findIndex(t => t.id === task.id);
      if (index !== -1) {
        const taskCompleted = !todos.value[index].completed;
        todos.value[index].completed = taskCompleted;
        
        if (taskCompleted) {
          // 标记为完成
          todos.value[index].completedAt = new Date().toISOString();
          
          // 如果没有设置时间，则设置默认时间
          if (!todos.value[index].startTime) {
            const now = new Date();
            const startTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
            
            // 计算默认结束时间（开始时间 + 30分钟）
            let endHour = now.getHours();
            let endMinute = now.getMinutes() + 30;
            if (endMinute >= 60) {
              endHour += 1;
              endMinute -= 60;
            }
            const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
            
            todos.value[index].startTime = startTime;
            todos.value[index].endTime = endTime;
          }
        } else {
          // 取消完成状态
          todos.value[index].completedAt = null;
        }
      }
    };

    // 重命名待办
    const renameTodo = (todo) => {
      const index = todos.value.findIndex(t => t.id === todo.id);
      if (index !== -1) {
        todos.value[index].name = todo.name;
      }
    };

    // 删除待办
    const deleteTodo = (task) => {
      const index = todos.value.findIndex(t => t.id === task.id);
      if (index !== -1) {
        todos.value.splice(index, 1);
      }
    };

    // 编辑待办
    const editTodo = (task) => {
      // 打开时间表单编辑待办的时间
      // 我们可以通过直接在时间表格里添加待办并设置时间来实现
      const index = todos.value.findIndex(t => t.id === task.id);
      if (index !== -1) {
        // 如果任务还没有时间信息，设置一个默认时间
        if (!task.startTime || !task.endTime) {
          const now = new Date();
          const startHour = now.getHours();
          const startMinute = now.getMinutes();
          
          // 格式化为 HH:MM 格式
          const startTime = `${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`;
          
          // 默认结束时间为开始时间后30分钟
          let endHour = startHour;
          let endMinute = startMinute + 30;
          
          // 处理分钟溢出
          if (endMinute >= 60) {
            endHour += 1;
            endMinute -= 60;
          }
          
          // 处理小时溢出
          if (endHour >= 24) {
            endHour = 23;
            endMinute = 59;
          }
          
          const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
          
          // 更新任务时间
          todos.value[index].date = dayjs().format('YYYY-MM-DD');
          todos.value[index].startTime = startTime;
          todos.value[index].endTime = endTime;
        }
        
        // 这里实际上是通过安排任务到当天时间表实现的编辑功能
        // 也可以根据需要设计专门的编辑对话框
      }
    };

    // 从左侧Todo组件更新待办（包括时间）
    const updateTodoWithTime = (updatedTodo) => {
      console.log("接收到更新待办请求:", updatedTodo);
      const index = todos.value.findIndex(t => t.id === updatedTodo.id);
        if (index !== -1) {
        // 确保任务有日期
        if (!updatedTodo.date) {
          updatedTodo.date = dayjs().format('YYYY-MM-DD');
        }
        
        // 确保时间格式正确
        if (updatedTodo.startTime && typeof updatedTodo.startTime === 'string') {
          // 保证格式为 HH:MM
          if (!/^\d{2}:\d{2}$/.test(updatedTodo.startTime)) {
            const parts = updatedTodo.startTime.split(':');
            updatedTodo.startTime = `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
          }
        }
        
        if (updatedTodo.endTime && typeof updatedTodo.endTime === 'string') {
          // 保证格式为 HH:MM
          if (!/^\d{2}:\d{2}$/.test(updatedTodo.endTime)) {
            const parts = updatedTodo.endTime.split(':');
            updatedTodo.endTime = `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
          }
        }
        
        // 更新任务的所有信息
        todos.value[index] = { ...todos.value[index], ...updatedTodo };
        console.log("待办已更新:", todos.value[index]);
        
        // 触发自定义事件，通知组件更新
        document.dispatchEvent(new CustomEvent('taskUpdated'));
      } else {
        console.warn("找不到要更新的待办:", updatedTodo.id);
      }
    };

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
    };
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
