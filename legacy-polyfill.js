/* legacy.html 专用：给不支持 Pointer Events 的浏览器（iOS 12 及更早）补一层
 * pointerdown / pointermove / pointerup / pointercancel / pointerleave 合成事件。
 * 纯 ES5，必须能在老引擎上直接跑。现代浏览器会跳过整个模块。 */
(function () {
  // 老内核没有 ResizeObserver；resize/orientationchange 已单独绑定，空缺即可
  if (!window.ResizeObserver) {
    window.ResizeObserver = function () {
      this.observe = function () {};
      this.unobserve = function () {};
      this.disconnect = function () {};
    };
  }

  if (window.PointerEvent) return;

  var stage = null;
  function stageEl() {
    if (!stage) stage = document.getElementById('stage');
    return stage;
  }

  function define(ev, key, value) {
    try {
      Object.defineProperty(ev, key, { value: value, configurable: true });
    } catch (e) {
      ev[key] = value;
    }
  }

  function fire(type, src, pointerType, buttons) {
    var target = stageEl();
    if (!target) return;
    var ev = document.createEvent('Event');
    ev.initEvent(type, true, true);
    define(ev, 'pointerType', pointerType);
    define(ev, 'pointerId', src.identifier || 1);
    define(ev, 'clientX', src.clientX);
    define(ev, 'clientY', src.clientY);
    define(ev, 'pageX', src.pageX != null ? src.pageX : src.clientX);
    define(ev, 'pageY', src.pageY != null ? src.pageY : src.clientY);
    define(ev, 'button', 0);
    define(ev, 'buttons', buttons);
    define(ev, 'isPrimary', true);
    ev.preventDefault = function () {};
    target.dispatchEvent(ev);
  }

  // 老内核没有 pointer capture API，补空实现避免调用报错
  if (!window.Element.prototype.setPointerCapture) {
    window.Element.prototype.setPointerCapture = function () {};
    window.Element.prototype.releasePointerCapture = function () {};
    window.Element.prototype.hasPointerCapture = function () { return false; };
  }

  document.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) return;
    if (e.cancelable) e.preventDefault();
    fire('pointerdown', e.touches[0], 'touch', 1);
  }, { passive: false, capture: false });

  document.addEventListener('touchmove', function (e) {
    if (!e.touches.length) return;
    if (e.cancelable) e.preventDefault();
    fire('pointermove', e.touches[0], 'touch', 1);
  }, { passive: false, capture: false });

  function touchEnd(e) {
    var t = e.changedTouches && e.changedTouches[0];
    if (!t) return;
    fire('pointerup', t, 'touch', 0);
  }
  document.addEventListener('touchend', touchEnd, false);
  document.addEventListener('touchcancel', touchEnd, false);

  var down = false;
  function inPanel(el) {
    while (el) {
      if (el.id === 'panel') return true;
      el = el.parentNode;
    }
    return false;
  }

  document.addEventListener('mousedown', function (e) {
    if (e.button !== 0) return;
    down = true;
    fire('pointerdown', e, 'mouse', 1);
  }, false);

  document.addEventListener('mousemove', function (e) {
    if (!down && inPanel(e.target)) {
      fire('pointerleave', e, 'mouse', 0);
      return;
    }
    fire('pointermove', e, 'mouse', down ? 1 : 0);
  }, false);

  document.addEventListener('mouseup', function (e) {
    if (!down) return;
    down = false;
    fire('pointerup', e, 'mouse', 0);
  }, false);
})();
