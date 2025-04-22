import { openDB } from 'idb';

const dbPromise = openDB('MyCacheDB', 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('todos')) {
      db.createObjectStore('todos', { keyPath: 'id' });
    }
  }
});

export async function addTodo(todo) {
  const db = await dbPromise;
  return db.add('todos', todo);
}

export async function getTodo(id) {
  const db = await dbPromise;
  return db.get('todos', id);
}

export async function getAllTodos() {
  const db = await dbPromise;
  return db.getAll('todos');
}

export async function updateTodo(todo) {
  const db = await dbPromise;
  const tx = db.transaction('todos', 'readwrite');
  const store = tx.objectStore('todos');
  return store.put(JSON.parse(JSON.stringify(todo)));  // 替代 structuredClone
  //return store.put(structuredClone(todo));
}

export async function deleteTodo(id) {
  const db = await dbPromise;
  return db.delete('todos', id);
}
