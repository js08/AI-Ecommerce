import express from 'express';
const app = express();

const rateLimitScore = new Map();
const REQUEST_LIMIT = 5;
const WINDOW_DURATION = 60000;

const customRateLimiter = (req, res, next) => {
    const userIp = req.ip;
    const now = Date.now();

    if (!rateLimitScore.has(userIp)) {
        rateLimitScore.set(userIp, []);

    }

    let reqTimeStamps = rateLimitScore.get(userIp);
    const expirationTime = now - WINDOW_DURATION;

    reqTimeStamps = reqTimeStamps.filter(timestamp => timestamp > expirationTime);

    if(reqTimeStamps.length >= REQUEST_LIMIT){
        return res.status(429).json({
            error: 'Too Many requests',
            message : `You hit the limit of ${REQUEST_LIMIT} requets per minute!`
        });
    }

    reqTimeStamps.push(now);
    rateLimitScore.set(userIp, reqTimeStamps);
    next();


};


app.use(customRateLimiter);

app.get('/api/data',(re,res) =>{

    res.json({ message: 'Sucess! you accessed the dat'});

});

app.listen(3000, () => console.log("server running 3000"));