import express from 'express';
import { db } from '../config.js';

import list from './list.js';
import task from './task.js';

export default function() {
    const app = express.Router();
    
    app.use('/list', list());
    app.use('/task', task());
    
    app.post('/reset', (req, res) => {
        db.prepare(`DELETE FROM task`).run();
        db.prepare(`DELETE FROM sqlite_sequence`).run();
        
        return res.json({ status: 'success' });
    });
    
    return app
}