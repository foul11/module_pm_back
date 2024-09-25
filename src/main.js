import { app, db } from './config.js';

import express from 'express';
import cors from 'cors';

import api from './api/_main.js';

app.use(cors());
app.use(express.json());

app.use('/api', api());

// @ts-ignore
app.use((err, req, res, next) => {
    console.error('TODO failed:');
    console.error(err);
    
    res.status(500).json({ error: 'Внутренняя ошибка сервера', ...(res.warns && res.warns.length ? { warns: res.warns } : {}) });
    
    return next(err);
});

app.listen(8081, () => {
    console.log('Listening on port 8081');
});