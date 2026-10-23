(function(root){
'use strict';
// Rich editor selection offsets use DOM text, which differs from innerText.
// Always send the captured selection string rather than slicing innerText.
function choose(snap,saved){
 const selection=snap.selection[1]>snap.selection[0]?snap:
  saved?.text===snap.text&&saved.selection[1]>saved.selection[0]?saved:null;
 if(selection){
  const [start,end]=selection.selection;
  return {start,end,selected:true,text:snap.rich?selection.selectionText:snap.text.slice(start,end)};
 }
 return {start:0,end:snap.text.length,selected:false,text:snap.text};
}
root.SupportWritingPassage={choose};
if(typeof module!=='undefined')module.exports={choose};
})(globalThis);
