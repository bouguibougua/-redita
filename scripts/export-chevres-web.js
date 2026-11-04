'use strict';
const fs=require('node:fs'),path=require('node:path');
const {spawn}=require('node:child_process');
const {startBrowser}=require('./export-menu-gif');
const root=path.resolve(__dirname,'..');
async function run(){
  if(!process.argv.includes('--encode-only'))await new Promise((resolve,reject)=>{
    const child=spawn(process.env.EREDITA_BLENDER||'/Applications/Blender.app/Contents/MacOS/Blender',
      ['--background','--factory-startup','--python-exit-code','1','--python','eredita3D/scripts/create_elevage_chevres.py'],{cwd:root,stdio:'inherit'});
    child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(new Error(`Blender : ${code}`)));
  });
  const browser=await startBrowser();
  try{
    for(const variant of ['petit','moyen','grand']){
      fs.copyFileSync(path.join(root,`eredita3D/exports/elevage_chevre_${variant}.glb`),path.join(root,`assets/models/elevage_chevre_${variant}.glb`));
      const source='data:image/png;base64,'+fs.readFileSync(path.join(root,`eredita3D/previews/elevage_chevre_${variant}_sprite.png`)).toString('base64');
      const result=await browser.page.evaluate(`(async()=>{
        const img=new Image();img.src=${JSON.stringify(source)};await img.decode();
        const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
        const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,256,256);
        if(ctx.getImageData(0,0,1,1).data[3]!==0)throw new Error('Fond du sprite non transparent');
        return canvas.toDataURL('image/webp',.95);
      })()`);
      if(!result.startsWith('data:image/webp;base64,'))throw new Error('Export WebP impossible');
      fs.writeFileSync(path.join(root,`assets/generated/herd-chevre-${variant}-v1.webp`),Buffer.from(result.split(',')[1],'base64'));
      console.log(`Élevage de chèvres ${variant} : GLB et sprite intégrés.`);
    }
  }finally{await browser.close();}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
