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
 *  completed: boolean,
 *  title: string,
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
        
        const row = (db.prepare(`UPDATE task SET data = json_set(data, '$.completed', json('true')) WHERE id = @id`).run({
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
        
        const row = (db.prepare(`UPDATE task SET data = json_set(data, '$.completed', json('false')) WHERE id = @id`).run({
            id: task,
        }));
        
        if (!row.changes)
            return res.status(400).json({ error: 'Not changed' });
        
        return res.json({
            status: 'success',
        });
    });
    
    return app
}