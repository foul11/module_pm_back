import { api } from '../src/utils.js';
import { inspect } from 'util';

/**
 * @typedef {import('../src/api/task.js').TaskDB} TaskDB
 * @typedef {import('../src/api/task.js').Task} Task
 * @typedef {import('../src/api/list.js').List} List
 * @typedef {{ status: 'success' }} Success
 */

/**
 * @template T
 * @typedef {Promise<[string, T]>} ApiResult
 */

/**
 * @param {number} id
 * @returns {ApiResult<Task>}
 */
async function getTask(id) {
    return api(`/task/${id}`, { method: 'GET' });
}

/**
 * @param {Task} task
 * @return {ApiResult<Success>}
 */
async function newTask(task) {
    return api(`/task`, { method: 'PUT', body: task });
}

/**
 * @param {number} id
 * @param {Task} task
 * @return {ApiResult<Success>}
 */
async function editTask(id, task) {
    return api(`/task/${id}`, { method: 'POST', body: task });
}

/**
 * @param {number} id
 * @returns {ApiResult<Task>}
 */
async function delTask(id) {
    return api(`/task/${id}`, { method: 'DELETE' });
}

/**
 * @param {number} id
 * @returns {ApiResult<Success>}
 */
async function completeTask(id) {
    return api(`/task/${id}/complete`, { method: 'POST' });
}

/**
 * @param {number} id
 * @returns {ApiResult<Success>}
 */
async function uncompleteTask(id) {
    return api(`/task/${id}/uncomplete`, { method: 'POST' });
}

/**
 * @param {number?} [id]
 * @returns {ApiResult<List>}
 */
async function getList(id = null) {
    return api(`/list${id ? `/${id}` : ''}`, { method: 'GET' });
}

/**
 * @param {List} list
 * @returns {ApiResult<Success>}
 */
async function uploadList(list) {
    return api(`/list`, { method: 'PUT', body: list });
}


/** @returns {ApiResult<Success>} */
async function resetDB() {
    return api(`/reset`, { method: 'POST' });
}

/**
 * @template T
 * @param {ApiResult<T>} data
 */
async function Log(data) {
    try {
        const [ link, res ] = await data;
        
        console.log(`${link}: ${inspect(res)}`);
    } catch (/** @type {ApiResult<string>} */ /** @type {any} */ e) {
        const [ link, error ] = e;
        console.error(`${link}: ${error}`);
    }
}


{
    await resetDB(); // Сбрасываем все данные
    
    Log(getTask(1)); // Проверяем задачу номер 1, ее не существует
    
    Log(newTask({ completed: false, desc: 'Test desc1', title: 'Test' })); // Создаем задачу, она будет 1
    Log(newTask({ completed: true,  desc: 'Test desc2', title: 'Tets' })); // Создаем задачу, она будет 2
    Log(newTask({ completed: false, desc: 'Test desc3', title: 'eTts' })); // Создаем задачу, она будет 3
    Log(newTask({ completed: true,  desc: 'Test desc4', title: 'etTs' })); // Создаем задачу, она будет 4
    
    Log(getTask(1)); // Проверяем задачу номер 1, она существует
    Log(getTask(2)); // Проверяем задачу номер 2, она существует
    Log(getTask(3)); // Проверяем задачу номер 3, она существует
    Log(getTask(4)); // Проверяем задачу номер 4, она существует
    
    Log(getList());  // Получаем все задачи, должно быть 4 шт
    
    Log(newTask({ completed: true,  desc: 'Test desc4', title: 'etTs', listId: 1 })); // Создаем задачу, она будет 5, список 1
    
    Log(getList());  // Получаем все задачи, должно быть 5 шт
    Log(getList(1)); // Получаем список 1,   должно быть 1 шт
    
    Log(delTask(3)); // Удаляем задачу номер 3, теперь задач 4шт
    Log(editTask(2, { completed: false,  desc: 'TTTT desc2', title: 'Tets', listId: 1 })); // Изменяем задачу номер 2, добавляем ее в список 1, обновляем описание, убираем выполение
    
    Log(getList());  // Получаем все задачи, должно быть 4 шт
    Log(getList(1)); // Получаем список 1,   должно быть 2 шт
    
    Log(completeTask(1)); // Альтернативный метод для изменения статуса задачи 1
    Log(completeTask(2)); // Альтернативный метод для изменения статуса задачи 2
    
    Log(getList());  // Получаем все задачи, должно быть 4 шт, все выполнены
    
    Log(uploadList([
        {
            listId: 1,
            completed: false,
            desc: '__TASK (1)__',
            title: 'List 1',
        },
        {
            listId: 1,
            completed: false,
            desc: '__TASK (2)__',
            title: 'List 1',
        },
    ])); // Загружаем первый список, 2 предыдущие задачи удалились, создались 2 новые
    
    Log(getList(1)); // Получаем список 1,   должно быть 2 шт
    
    Log(uploadList([
        {
            completed: false,
            desc: '__KSAT (1)__',
            title: 'List default',
        },
    ])); // Задачи без списка, попадают в дефолтный список, НЕ удаляя предыдущие, добавляем 1 задачу
    
    Log(getList());  // Получаем все задачи, должно быть 5 шт
}
