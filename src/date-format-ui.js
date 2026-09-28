// Shared presentation only: original controls retain ISO values for APIs and forms.
(() => {
  if (window.sv365Dates) return;
  const pad = n => String(n).padStart(2, '0');
  function valid(y, m, d) {
    const date = new Date(`${y}-${pad(m)}-${pad(d)}T00:00:00Z`);
    return Number(y) > 0 && Number.isFinite(+date) && date.getUTCFullYear() === +y && date.getUTCMonth() + 1 === +m && date.getUTCDate() === +d;
  }
  function format(text) {
    return String(text ?? '').replace(/(^|[^\w/-])(\d{4})-(\d{2})-(\d{2})(?=$|[^\d-])/g,
      (all, before, y, m, d) => valid(y,m,d) ? `${before}${d}/${m}/${y}` : all)
      .replace(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/g,
        (all,d,m,y) => valid(y,m,d) ? `${pad(d)}/${pad(m)}/${y}` : all);
  }
  function parse(text, timed) {
    if (!text.trim()) return '';
    const m = /^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(\.\d{1,3})?)?)?$/.exec(text.trim());
    if (!m || !valid(m[3],m[2],m[1]) || Boolean(m[4]) !== timed || (timed && (+m[4]>23 || +m[5]>59 || +(m[6]||0)>59))) return null;
    return `${m[3]}-${m[2]}-${m[1]}` + (timed ? `T${m[4]}:${m[5]}${m[6] ? ':'+m[6]+(m[7]||'') : ''}` : '');
  }
  window.sv365Dates = {format, parse};
  const controls = new WeakMap();
  function enhance(input) {
    if (controls.has(input)) return;
    const timed = input.type === 'datetime-local';
    const box = document.createElement('span'); box.className = 'svDateControl';
    const display = document.createElement('input'); display.type = 'text';
    display.className = input.className; display.classList.add('svDateDisplay');
    display.placeholder = timed ? 'dd/mm/yyyy hh:mm' : 'dd/mm/yyyy';
    display.autocomplete = 'off'; display.inputMode = timed ? 'text' : 'numeric';
    display.setAttribute('aria-label', (input.getAttribute('aria-label') || input.labels?.[0]?.textContent || input.name || 'Date').trim() + ' (' + display.placeholder + ')');
    input.parentNode.insertBefore(box,input); box.append(display,input);
    input.classList.add('svDateNative'); input.title = 'Choose date from calendar';
    const sync = () => {
      display.value = format(input.value).replace('T',' ');
      display.required = input.required; display.disabled = input.disabled; display.readOnly = input.readOnly;
      display.setCustomValidity('');
    };
    controls.set(input,{sync,display});
    // Existing modules assign these properties when opening/editing records.
    for (const key of ['value','valueAsDate','valueAsNumber']) {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,key);
      Object.defineProperty(input,key,{configurable:true,get(){return descriptor.get.call(this);},set(value){descriptor.set.call(this,value);sync();}});
    }
    const update = event => {
      const value = parse(display.value,timed);
      const raw = display.value;
      input.value = value === null ? '' : value;
      display.value = raw;
      const message = value === null ? 'Enter a valid date as '+display.placeholder : input.validationMessage;
      display.setCustomValidity(message);
      if (value !== null) input.dispatchEvent(new Event(event.type,{bubbles:true}));
    };
    display.addEventListener('input', update); display.addEventListener('change', update);
    input.addEventListener('input',sync); input.addEventListener('change',sync);
    input.addEventListener('invalid', event => {event.preventDefault();display.setCustomValidity(input.validationMessage);display.focus();display.reportValidity();});
    input.form?.addEventListener('reset',()=>queueMicrotask(sync));
    sync();
  }
  const skip = 'script,style,textarea,input,code,pre,[contenteditable="true"]';
  function scan(root) {
    if (root.nodeType === Node.TEXT_NODE) {
      if (!root.parentElement || root.parentElement.closest(skip)) return;
      const next = format(root.nodeValue); if (next !== root.nodeValue) root.nodeValue = next;
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE || root.matches(skip)) {
      if (root.matches?.('input[type="date"],input[type="datetime-local"]')) enhance(root);
      return;
    }
    root.querySelectorAll('input[type="date"],input[type="datetime-local"]').forEach(enhance);
    const walker = document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    let node; while ((node=walker.nextNode())) scan(node);
  }
  function start() {
    scan(document.body);
    new MutationObserver(changes => {
      for (const change of changes) {
        if (change.type === 'attributes') { controls.get(change.target)?.sync(); continue; }
        if (change.type === 'characterData') scan(change.target);
        else change.addedNodes.forEach(scan);
      }
    }).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['value','min','max','required','disabled','readonly']});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start); else start();
})();
