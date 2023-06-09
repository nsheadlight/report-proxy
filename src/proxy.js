#!/usr/bin/env node

const express = require('express');
const fetch = require('node-fetch');
const {createProxyMiddleware} = require('http-proxy-middleware');


let {
    username,
    password,
    port: proxyPort,
} = parseArgs();

const port = 8085;
(async () => {
    const sessionId = await login(username, password);

    express()
        .get('/', (req, res, next) => {
            res.set('Content-Type', 'text/html');
            res.send(`Run your report and change your port to ${port}`);
        })
        .get('/1.0/Report/*', createProxyMiddleware({
            target: `http://localhost:${proxyPort}/`,
            changeOrigin: true,
            logLevel: 'debug',
            cookieDomainRewrite: 'localhost',
            cookiePathRewrite: '/'
        }))
        .use('/1.0', createProxyMiddleware({
            target: `https://api.qa.headlight.com`,
            changeOrigin: true,
            logLevel: 'debug',
            cookieDomainRewrite: 'localhost',
            cookiePathRewrite: '/',
            onProxyReq(clientReq, req, res, options) {
                clientReq.setHeader("x-application-name", ``);
                clientReq.setHeader("cookie", `UserSession=${sessionId}`);
                clientReq.setHeader("authorization", `Bearer ${sessionId}`);
            }
        }))
        .use((req, res, next) => {
            res.setHeader('Access-Control-Allow-Origin', '*');
            next();
        })
        .listen(port);
    console.log('Listening on port http://localhost:8085/');
})();

function login(username, password) {
    return fetch('https://api.qa.headlight.com/1.0/Authenticate', {
        method: 'POST',
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ "UserName": username, "Password": password })
    }).then(v => v.json()).then(v => {
        if(!v?.SessionID) {
            console.error('Failed to login, response is', v);
            process.exit(1);
        } else {
            console.log(`Logged in as ${username}`);
            return v.SessionID;
        }
    })
}

function parseArgs() {
    const args = process.argv.slice(2);
    
    if(args.length < 2) {
        console.log('Invalid arguments. Usage:')
        console.log(`report-proxy <username> <password> [flags]`);
        console.log(`  where flags:`);
        console.log(`  -p --port Port of reports instance (default 8080)`);
        process.exit(1)
    }

    let params = {
        port: 8080
    };
    let token = ''
    for(let i=2;i<args.length;i++) {
        if(token) {
            if(token === 'port') {
                params[token] = args[i];
            }
            token = undefined;
        } else if(args[i] === '-p' || args[i] === '--port') {
            token = 'port'
        }
    }
    
    return {
        username: args[0],
        password: args[1],
        ...params
    }
}