import express from 'express';

import { db } from '../config.js';
import { TypeChecker } from '../TypeChecker.js';

/**
 * @typedef {import('./task.js').TaskDB} TaskDB
 * @typedef {import('./task.js').Task} Task
 */

/**
 * @typedef {Task[]} List
 */

/** @type {TypeChecker<List>} */
const CheckTask = new TypeChecker('List');

export default function() {
    const app = express.Router();
    
    app.get('/', (req, res) => {
        const row = /** @type {TaskDB[]} */ (db.prepare(`SELECT * FROM task`).all());
        
        return res.json(
            row.map(({ id, listId, data }) => ({
                id,
                listId,
                ...JSON.parse(data)
            }))
        );
    });
    
    app.get('/:listId', (req, res) => {
        const { listId } = req.params;
        const row = /** @type {TaskDB[]} */ (db.prepare(`SELECT * FROM task WHERE listId = ?`).all(listId));
        
        return res.json(
            row.map(({ id, listId, data }) => ({
                id,
                listId,
                ...JSON.parse(data)
            }))
        );
    });
    
    app.put('/', (req, res) => {
        const { warns, input: listObj } = CheckTask.checkForWarn(req.body); res.warns = warns;
        const lists = new Set(listObj.map(taks => taks.listId));
        
        let isFailed = false;
        
        for (const list of lists.values()) {
            db.prepare(`DELETE FROM task WHERE listId = @listId`).run({ listId: list });
        }
        
        // if (lists.has(undefined)) {
        db.prepare(`DELETE FROM task`).run();
        db.prepare(`DELETE FROM sqlite_sequence`).run();
        // }
        
        for (const task of listObj) {
            const row = (db.prepare(`INSERT INTO task (listId, data) VALUES (@listId, @data)`).run({
                listId: task.listId,
                data: JSON.stringify({ ...task, id: undefined, listId: undefined })
            }));
            
            if (!row.changes)
                isFailed = true;
        }
        
        if (isFailed)
            return res.status(400).json({ error: 'Not updated fully/partially' });
        
        return res.json({
            status: 'success',
        });
    });
    
    return app
}