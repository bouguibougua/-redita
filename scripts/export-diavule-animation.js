'use strict';
// Composition de l’illustration intacte et de la flamme créée avec image_gen.
// Outil de préparation macOS, sans dépendance du site : Canvas, AVFoundation, ImageIO.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { spawn } = require('node:child_process');
const { startBrowser } = require('./export-menu-gif');
const root = path.join(__dirname, '..'), assets = path.join(root, 'assets/mythology');
const frames = fs.mkdtempSync(path.join(os.tmpdir(), 'eredita-diavule-'));
const fps = 30, seconds = 4, count = fps * seconds, width = 960, height = 640;
const source = file => 'data:image/' + (file.endsWith('.webp') ? 'webp' : 'png') + ';base64,' + fs.readFileSync(path.join(assets, file)).toString('base64');
async function run() {
  let browser;
  const existing = new Set(fs.readdirSync(assets));
  try {
    browser = await startBrowser();
    await browser.page.evaluate(`(async () => {
      const load = url => new Promise((resolve,reject) => { const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=url; });
      const [base,atlas] = await Promise.all([load(${JSON.stringify(source('u-diavulu.webp'))}),load(${JSON.stringify(source('u-diavulu-flames.png'))})]);
      const canvas = document.createElement('canvas');canvas.width=${width};canvas.height=${height};
      const ctx=canvas.getContext('2d'), sprites=[];
      for(let row=0;row<4;row++) for(let col=0;col<4;col++) {
        const tile=document.createElement('canvas');tile.width=tile.height=Math.ceil(atlas.width/4);
        const g=tile.getContext('2d');g.drawImage(atlas,col*atlas.width/4,row*atlas.height/4,atlas.width/4,atlas.height/4,0,0,tile.width,tile.height);
        const pixels=g.getImageData(0,0,tile.width,tile.height).data;
        let left=tile.width,right=0,top=tile.height,bottom=0;
        for(let y=0;y<tile.height;y++) for(let x=0;x<tile.width;x++) {
          const p=(y*tile.width+x)*4;
          if(pixels[p+3]>160 && pixels[p]>180 && pixels[p+1]>90) { left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y); }
        }
        let weightedX=0,weight=0;
        for(let y=Math.max(top,bottom-12);y<=bottom;y++) for(let x=left;x<=right;x++) {
          const p=(y*tile.width+x)*4,bright=pixels[p+3]>160?pixels[p+1]:0;
          weightedX+=x*bright;weight+=bright;
        }
        sprites.push({image:tile,anchorX:weight?weightedX/weight:(left+right)/2,anchorY:bottom,scale:190/Math.max(1,bottom-top)});
      }
      window.renderDiavule = frame => {
        const t=frame/${count},angle=t*Math.PI*2;
        ctx.clearRect(0,0,canvas.width,canvas.height);ctx.save();ctx.scale(canvas.width/base.width,canvas.height/base.height);
        ctx.drawImage(base,0,0);
        const pulse=.94+.06*Math.sin(angle*3)+.025*Math.sin(angle*7),handX=1235,handY=625;
        // La source, les cornes, les ailes et le visage ne sont ni déformés ni régénérés.
        ctx.save();ctx.globalCompositeOperation='screen';
        const glow=ctx.createRadialGradient(handX,handY-50,8,handX,handY-50,260);
        glow.addColorStop(0,'rgba(255,174,62,'+(.2*pulse)+')');glow.addColorStop(.35,'rgba(255,91,15,'+(.1*pulse)+')');glow.addColorStop(1,'rgba(255,30,0,0)');
        ctx.fillStyle=glow;ctx.fillRect(handX-280,handY-330,560,560);ctx.restore();
        const position=t*32,at=Math.floor(position)%16,mix=position-Math.floor(position),blend=mix*mix*(3-2*mix);
        function flame(sprite,alpha) {
          ctx.save();ctx.globalAlpha=alpha;ctx.translate(handX,handY);
          ctx.scale(sprite.scale*(.97+.035*Math.sin(angle*3)),sprite.scale*(1+.035*Math.sin(angle*2)));
          ctx.drawImage(sprite.image,-sprite.anchorX,-sprite.anchorY);ctx.restore();
        }
        flame(sprites[at],1-blend);flame(sprites[(at+1)%16],blend);
        // Braises en boucle, avec apparition et extinction progressives.
        ctx.save();ctx.globalCompositeOperation='screen';
        for(let i=0;i<16;i++) {
          const life=(t*2+i*.61803398875)%1,fade=Math.sin(Math.PI*life);
          const x=handX+Math.sin(angle*2+i*2.39)*life*68+(i%3-1)*18,y=handY-40-life*235;
          ctx.globalAlpha=fade*.65;ctx.fillStyle=i%3?'#ff9a30':'#ffe1a0';ctx.fillRect(x,y,1.4+(i%3)*.55,3+(i%2)*1.3);
        }
        ctx.restore();ctx.restore();return canvas.toDataURL('image/png');
      };
      return {sprites:sprites.length,transparent:atlas.width};
    })()`);
    for (let frame = 0; frame < count; frame++) {
      const data = await browser.page.evaluate(`renderDiavule(${frame})`);
      fs.writeFileSync(path.join(frames,String(frame).padStart(3,'0')+'.png'),Buffer.from(data.split(',')[1],'base64'));
    }
    // La première image permet aussi de contrôler précisément l’ancrage de la flamme.
    fs.copyFileSync(path.join(frames,'000.png'),path.join(assets,'u-diavulu-motion-poster.png'));
    const swift = path.join(frames,'encode.swift');
    fs.writeFileSync(swift, `import Foundation
import AVFoundation
import CoreImage
import ImageIO
import UniformTypeIdentifiers
let directory=URL(fileURLWithPath:CommandLine.arguments[1])
let output=URL(fileURLWithPath:CommandLine.arguments[2])
let count=${count}, fps=${fps}, width=${width}, height=${height}
let movie=output.appendingPathComponent("u-diavulu-motion.mp4")
if FileManager.default.fileExists(atPath:movie.path) { try FileManager.default.removeItem(at:movie) }
let writer=try AVAssetWriter(outputURL:movie,fileType:.mp4)
writer.shouldOptimizeForNetworkUse=true
let input=AVAssetWriterInput(mediaType:.video,outputSettings:[AVVideoCodecKey:AVVideoCodecType.h264,AVVideoWidthKey:width,AVVideoHeightKey:height,AVVideoCompressionPropertiesKey:[AVVideoAverageBitRateKey:1_600_000,AVVideoExpectedSourceFrameRateKey:fps,AVVideoMaxKeyFrameIntervalKey:fps,AVVideoProfileLevelKey:AVVideoProfileLevelH264HighAutoLevel]])
let adaptor=AVAssetWriterInputPixelBufferAdaptor(assetWriterInput:input,sourcePixelBufferAttributes:[kCVPixelBufferPixelFormatTypeKey as String:kCVPixelFormatType_32BGRA,kCVPixelBufferWidthKey as String:width,kCVPixelBufferHeightKey as String:height])
writer.add(input);writer.startWriting();writer.startSession(atSourceTime:.zero)
let context=CIContext(),rect=CGRect(x:0,y:0,width:width,height:height)
let gifURL=output.appendingPathComponent("u-diavulu-motion.gif")
let gif=CGImageDestinationCreateWithURL(gifURL as CFURL,UTType.gif.identifier as CFString,count/2,nil)!
CGImageDestinationSetProperties(gif,[kCGImagePropertyGIFDictionary:[kCGImagePropertyGIFLoopCount:0]] as CFDictionary)
for index in 0..<count {
  let file=directory.appendingPathComponent(String(format:"%03d.png",index))
  let image=CIImage(contentsOf:file)!
  while !input.isReadyForMoreMediaData { usleep(2000) }
  var buffer:CVPixelBuffer?;CVPixelBufferPoolCreatePixelBuffer(kCFAllocatorDefault,adaptor.pixelBufferPool!,&buffer)
  context.render(image,to:buffer!,bounds:rect,colorSpace:CGColorSpaceCreateDeviceRGB())
  guard adaptor.append(buffer!,withPresentationTime:CMTime(value:Int64(index),timescale:Int32(fps))) else { fatalError("Échec vidéo") }
  if index%2==0 {
    let source=CGImageSourceCreateWithURL(file as CFURL,nil)!
    let frame=CGImageSourceCreateThumbnailAtIndex(source,0,[kCGImageSourceCreateThumbnailFromImageAlways:true,kCGImageSourceThumbnailMaxPixelSize:768] as CFDictionary)!
    let tick=index/2,delay=(round(Double(tick+1)*100/15)-round(Double(tick)*100/15))/100
    CGImageDestinationAddImage(gif,frame,[kCGImagePropertyGIFDictionary:[kCGImagePropertyGIFDelayTime:delay,kCGImagePropertyGIFUnclampedDelayTime:delay]] as CFDictionary)
  }
}
input.markAsFinished();let done=DispatchSemaphore(value:0);writer.finishWriting{done.signal()};done.wait()
guard writer.status == .completed && CGImageDestinationFinalize(gif) else { fatalError("Échec de l’export animé") }
print("U Diavule : MP4 30 i/s, GIF 15 i/s, 4 secondes, boucle infinie.")
`);
    await new Promise((resolve,reject) => {
      const encoder=spawn('/usr/bin/swift',['-module-cache-path',path.join(os.tmpdir(),'eredita-swift-modules'),swift,frames,assets],{stdio:'inherit'});
      encoder.on('error',reject);encoder.on('exit',code=>code===0?resolve():reject(new Error('Encodage impossible : '+code)));
    });
    for(const extension of ['gif','mp4']) {
      const file=path.join(assets,'u-diavulu-motion.'+extension);console.log(file,Math.round(fs.statSync(file).size/1024)+' Ko');
    }
    // AVFoundation peut laisser sa copie temporaire d’optimisation réseau.
    for(const file of fs.readdirSync(assets)) if(file.startsWith('u-diavulu-motion.mp4.sb-') && !existing.has(file)) fs.unlinkSync(path.join(assets,file));
  } finally { await browser?.close();fs.rmSync(frames,{recursive:true,force:true}); }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
