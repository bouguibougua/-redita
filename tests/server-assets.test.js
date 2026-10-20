"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), http = require("node:http");
const { spawn } = require("node:child_process"), { gunzipSync } = require("node:zlib");
const project = path.join(__dirname,".."), port = 8875;
function request(url, headers = {}, method = "GET") {
  return new Promise((resolve,reject) => {
    const req=http.request({ hostname:"127.0.0.1",port,path:url,headers,method },res => {
      const chunks=[]; res.on("data",chunk => chunks.push(chunk));
      res.on("end",() => resolve({ status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks) }));
    }); req.on("error",reject); req.end();
  });
}
async function run() {
  const server=spawn(process.execPath,["server.js"],{ cwd:project,env:{ ...process.env,PORT:String(port) },stdio:"ignore" });
  const temporary=path.join(project,"assets",`.cache-test-${process.pid}.txt`);
  try {
    let plain;
    for(let attempt=0;attempt<40&&!plain;attempt++) {
      try { plain=await request("/"); } catch (_) { await new Promise(resolve=>setTimeout(resolve,50)); }
    }
    assert.ok(plain,"The server starts"); assert.equal(plain.status,200);
    const html=fs.readFileSync(path.join(project,"index.html")); assert.deepEqual(plain.body,html);
    const zipped=await request("/",{ "Accept-Encoding":"br, gzip;q=0.8, deflate" });
    assert.equal(zipped.headers["content-encoding"],"gzip"); assert.deepEqual(gunzipSync(zipped.body),html);
    assert.ok(zipped.body.length<html.length/2,"Gzip materially reduces the transferred HTML");
    assert.equal((await request("/",{ "Accept-Encoding":"gzip;q=0" })).headers["content-encoding"],undefined);
    const cached=await request("/",{ "If-None-Match":plain.headers.etag,"Accept-Encoding":"gzip" });
    assert.equal(cached.status,304); assert.equal(cached.body.length,0);
    fs.writeFileSync(temporary,"first"); const first=await request(`/assets/${path.basename(temporary)}`);
    fs.writeFileSync(temporary,"changed contents");
    const second=await request(`/assets/${path.basename(temporary)}`,{ "If-None-Match":first.headers.etag });
    assert.equal(second.status,200); assert.equal(second.body.toString(),"changed contents");
    assert.notEqual(second.headers.etag,first.headers.etag,"Changed files are never served from an old browser cache");
    const sprite=await request("/assets/generated/characters-atlas.webp");
    assert.equal(sprite.headers["content-type"],"image/webp"); assert.equal(sprite.body.subarray(8,12).toString(),"WEBP");
    const audio=fs.readFileSync(path.join(project,"assets/audio/game/combat.mp3"));
    const piece=await request("/assets/audio/game/combat.mp3",{ Range:"bytes=0-1023" });
    assert.equal(piece.status,206); assert.equal(piece.headers["content-type"],"audio/mpeg");
    assert.equal(piece.headers["content-range"],`bytes 0-1023/${audio.length}`); assert.deepEqual(piece.body,audio.subarray(0,1024));
    const suffix=await request("/assets/audio/game/combat.mp3",{ Range:"bytes=-512" }); assert.deepEqual(suffix.body,audio.subarray(-512));
    const invalid=await request("/assets/audio/game/combat.mp3",{ Range:`bytes=${audio.length}-` }); assert.equal(invalid.status,416);
    const head=await request("/assets/audio/game/combat.mp3",{},"HEAD"); assert.equal(head.body.length,0); assert.equal(Number(head.headers["content-length"]),audio.length);
    const videoPath = '/assets/mythology/a-stregha-bianca-motion.mp4';
    const video = fs.readFileSync(path.join(project,'assets/mythology/a-stregha-bianca-motion.mp4'));
    const videoHead = await request(videoPath, {}, 'HEAD');
    assert.equal(videoHead.headers['content-type'], 'video/mp4'); assert.equal(videoHead.body.length, 0);
    assert.equal(Number(videoHead.headers['content-length']), video.length);
    const videoRange = await request(videoPath, {Range:'bytes=0-1023'});
    assert.equal(videoRange.status, 206); assert.equal(videoRange.headers['accept-ranges'], 'bytes');
    assert.deepEqual(videoRange.body, video.subarray(0,1024));
    assert.equal((await request(videoPath, {Range:`bytes=${video.length}-`})).status, 416);
    assert.equal((await request("/.env")).status,403); assert.equal((await request("/assets/missing.webp")).status,404);
    console.log("Fichiers HTTP : gzip, cache, WebP, streaming audio et MP4 partiel validés.");
  } finally { server.kill(); if(fs.existsSync(temporary))fs.unlinkSync(temporary); }
}
run().catch(error => { console.error(error); process.exitCode=1; });
