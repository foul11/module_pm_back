import express from 'express';

import { db } from '../config.js';
import { TypeChecker } from '../TypeChecker.js';

/**
 * @typedef {{
 *  id: number,
 *  listId: number,
 *  data: string,
 * }} TaskDB
 */

/**
 * @typedef {{
 *  complete: boolean,
 *  name: string,
 *  desc: string,
 *  id?: number,
 *  listId?: number,
 * }} Task
 */

/** @type {TypeChecker<Task>} */
const CheckTask = new TypeChecker('Task');

export default function() {
    const app = express.Router();
    
    app.get('/:task', (req, res) => {
        const { task } = req.params;
        
        const row = /** @type {TaskDB} */ (db.prepare(`SELECT * FROM task WHERE id = ?`).get(task));
        
        if (!row)
            return res.status(404).json({ error: 'Not found' });
        
        return res.json({
            id: row.id,
            listId: row.listId,
            ...JSON.parse(row.data)
        });
    });
    
    app.put('/', (req, res) => {
        const { warns, input: taskObj } = CheckTask.checkForWarn(req.body); res.warns = warns;
        
        const row = (db.prepare(`INSERT INTO task (listId, data) VALUES (@listId, @data)`).run({
            listId: taskObj.listId,
            data: JSON.stringify({ ...taskObj, id: undefined, listId: undefined })
        }));
        
        if (!row.changes)
            return res.status(400).json({ error: 'Not updated' });
        
        return res.json({
            status: 'success',
            id: row.lastInsertRowid,
        });
    });
    
    app.delete('/:task', (req, res) => {
        const { task } = req.params;
        
        const row = /** @type {TaskDB} */ (db.prepare(`DELETE FROM task WHERE id = ? RETURNING *`).get(task));
        
        if (!row)
            return res.status(400).json({ error: 'Not deleted' });
        
        return res.json({
            id: row.id,
            listId: row.listId,
            ...JSON.parse(row.data)
        });
    });
    
    app.post('/:task', (req, res) => {
        const { task } = req.params;
        const { warns, input: taskObj } = CheckTask.checkForWarn(req.body); res.warns = warns;
        
        const row = (db.prepare(`UPDATE task SET data = @data, listId = @listId WHERE id = @id`).run({
            id: task,
            listId: taskObj.listId,
            data: JSON.stringify({ ...taskObj, id: undefined, listId: undefined })
        }));
        
        if (!row.changes)
            return res.status(400).json({ error: 'Not updated' });
        
        return res.json({
            status: 'success',
        });
    });
    
    app.post('/:task/complete', (req, res) => {
        const { task } = req.params;
        
        const row = (db.prepare(`UPDATE task SET data = json_set(data, '$.complete', json('true')) WHERE id = @id`).run({
            id: task,
        }));
        
        if (!row.changes)
            return res.status(400).json({ error: 'Not changed' });
        
        return res.json({
            status: 'success',
        });
    });
    
    app.post('/:task/uncomplete', (req, res) => {
        const { task } = req.params;
        
        const row = (db.prepare(`UPDATE task SET data = json_set(data, '$.complete', json('false')) WHERE id = @id`).run({
            id: task,
        }));
        
        if (!row.changes)
            return res.status(400).json({ error: 'Not changed' });
        
        return res.json({
            status: 'success',
        });
    });
    
    app.post('/:task/move/:toIdx', (req, res) => {
        const { task, toIdx } = req.params;
        
        /**
         * @template T
         * @param {T[]} array
         * @param {number} sourceIndex
         * @param {number} targetIndex
         */
        function reorderArray(array, sourceIndex, targetIndex) {
            const newArray = [...array];
            const element = newArray.splice(sourceIndex, 1)[0];
            newArray.splice(targetIndex, 0, element);
            return newArray;
        };
        
        const rows = /** @type {TaskDB[]} */ (db.prepare(`SELECT * FROM task`).all());
        
        const taskIdx = rows.findIndex((v) => v.id === parseInt(task));
        const toIdxNum = parseInt(toIdx);
        
        const output = reorderArray(
            rows,
            taskIdx,
            toIdxNum
        ).map((e, i) => ({ ...e, id: i + 1 }));
        
        db.prepare(`DELETE FROM task`).run();
        
        for (const row of output) {
            db.prepare(`INSERT INTO task (id, listId, data) VALUES (@id, @listId, @data)`).run(row);
        }
        
        return res.json(
            output.map(({ id, listId, data }) => ({
                id,
                listId,
                ...JSON.parse(data)
            }))
        );
    });
    
    return app
}