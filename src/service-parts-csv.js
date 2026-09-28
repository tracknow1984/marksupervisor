// Parse quoted CSV, including escaped quotes, commas and multi-line descriptions.
function parse(text){
 text=String(text||'').replace(/^\uFEFF/,'');if(Buffer.byteLength(text)>1000000)throw Error('CSV must be under 1 MB.');
 const rows=[];let row=[],cell='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}
 if(c==='"'){if(cell||closed)throw Error('Invalid CSV quoting.');quoted=true;}
 else if(c===','||c==='\n'||c==='\r'){row.push(cell.trim());cell='';closed=false;if(c!==','){if(c==='\r'&&text[i+1]==='\n')i++;if(row.some(Boolean))rows.push(row);row=[];}}
 else {if(closed&&!/\s/.test(c))throw Error('Invalid text after CSV quote.');if(!closed)cell+=c;}
 }
 if(quoted)throw Error('CSV contains an unclosed quote.');row.push(cell.trim());if(row.some(Boolean))rows.push(row);
 if(rows.length<2)throw Error('Add a header and at least one part row.');if(rows.length>501)throw Error('Upload a maximum of 500 parts at a time.');
 const headers=rows.shift().map(h=>h.toLowerCase().replace(/[^a-z0-9]/g,''));if(new Set(headers).size!==headers.length)throw Error('CSV has duplicate column headings.');
 const col=(aliases)=>headers.findIndex(h=>aliases.includes(h));
 const names={name:col(['partdescription','description','name']),sku:col(['partno','partnumber','sku']),genuine:col(['genuine','genuinepart']),nonGenuine:col(['nongenuine','nongenuinepart']),price:col(['costperpart','cost','price','unitprice']),quantity:col(['quantity','qty']),unit:col(['unit']),supplier:col(['supplier'])};
 if(names.name<0||names.price<0||names.quantity<0||(names.genuine<0&&names.nonGenuine<0))throw Error('Use columns Part Description, Part No., Genuine, Non Genuine, Cost per Part and Quantity. Download the template for the correct format.');
 const yesNo=v=>/^(yes|y|true|1)$/i.test(v)?true:/^(no|n|false|0)$/i.test(v)?false:null;
 return rows.map((r,i)=>{if(r.length!==headers.length)throw Error('Row '+(i+2)+': number of columns does not match the header.');const val=k=>names[k]<0?'':r[names[k]];let g=yesNo(val('genuine')),n=yesNo(val('nonGenuine'));if(g===null&&n!==null)g=!n;if(g===null||(n!==null&&g===n))throw Error('Row '+(i+2)+': set Genuine and Non Genuine to opposite Yes/No values.');if(!val('price')||!val('quantity'))throw Error('Row '+(i+2)+': cost and quantity are required.');const price=val('price').replace(/^\$/,'').replace(/,/g,'');return{name:val('name'),sku:val('sku'),partKind:g?'genuine':'non-genuine',price,quantity:val('quantity'),unit:val('unit')||'each',supplier:val('supplier')};});
}
module.exports={parse};
