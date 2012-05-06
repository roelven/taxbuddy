/**
 * throbber.js
 *
 * A canvas-based javascript loading indicator.
 *
 * Highly inspired by:
 * - http://starkravingcoder.blogspot.com/2007/09/canvas-loading-indicator.html
 * - http://www.netzgesta.de/busy/
 * - http://ablog.gawley.org/2009/05/randomness-throbbers-and-tag.html
 *
 * Copyright 2011 SoundCloud Limited
 *
 * @author yvg, jzaefferer, nickf
 * @version 0.1.2
 * @license MIT Licensed
 * @preserve
 */
/*global window, document*/
var Throbber = (function() {
  var Handle;
  var Throbber;
  /**
   * Garbage collection counter, each tick increases this by one.
   * @type {Number}
   */
  var gcCounter = 0;
  /**
   * Garbage collection interval
   * Any time that `gcCounter % GC_INTERVAL === 0`, then all the handles in `active` are checked to ensure that they
   * are still a part of the document. This is fudged slightly, just by checking that the canvas element has a
   * `html` tag as an ancestor.
   * @const
   * @type {Number}
   */
  var GC_INTERVAL = 50;

  /**
   * The window.requestAnimationFrame function or its polyfill in non-supporting browsers
   * @type {Function}
   */
  var requestAnimationFrame;
  /**
   * The time that the current animation loop started.
   * Will be either a Number (a timestamp) or `null` indicating that there is no animation running.
   * @type {?Number}
   */
  var startAnimationTime = null;

  /**
   * Create a shallow copy of an object
   * @param  {Object} input The object to copy
   * @return {Object}
   */
  function extend(input) {
    var output = {};
    var key;
    for (key in input) {
      if (input.hasOwnProperty(key)) {
        output[key] = input[key];
      }
    }
    return output;
  }

  /**
   * Checks if the given element has a particular class.
   * @param  {DOMElement} el
   * @param  {String} className
   * @return {Boolean}
   */
  function hasClass(el, className) {
    return (new RegExp('\\b' + className + '\\b')).test(el.className);
  }

  /**
   * Get the canvas element from the given selector.
   * Note that this function *can have side-effects* depending on what is passed.
   *
   * - if a canvas element is passed, it is returned
   * - if any other element is passed, a canvas element is created, appended to that element and returned
   * - if a jQuery result set is passed, *only the first element* is converted to a throbber. Note that if you have
   *   jQuery available in your calling script, you can use `$("foo").throbber()`.
   *
   * @param  {DOMElement|jQuery} selector
   * @return {DOMElement|Boolean}   A canvas element, or false.
   */
  function getCanvas(selector) {
    var canvas;
    var children;
    var i;
    var child;
    if (!selector) {
      return false;
    } else if (selector.nodeName) {
      // DOMElement
      if (selector.nodeName.toLowerCase() === 'canvas') {
        if (!hasClass(selector, 'throbber')) {
          selector.className += ' throbber';
        }
        return selector;
      } else {
        children = selector.childNodes;
        for (i = children.length - 1; i >= 0; i--) {
          child = children[i];
          if (child.nodeName.toLowerCase() === 'canvas' && hasClass(child, 'throbber')) {
            return child;
          }
        }

        canvas = document.createElement('canvas');
        canvas.className = 'throbber';
        selector.appendChild(canvas);
        return canvas;
      }
    } else if (typeof selector === 'object' && typeof selector.jquery === 'string') {
      // jQuery result set
      if (selector.length) {
        return getCanvas(selector[0]);
      } else {
        return false;
      }
    } else {
      return false;
    }
  }
  /**
   * Draws a single bar with the size given in the options, and the opacity defined by `opacity`.
   * Relies on the context to have already been rotated and translated as required.
   *
   * @param  {Object} options The throbber's options
   * @param  {Number} opacity The opacity of the current bar
   */
  function drawBar(options, opacity) {
    var w = options.size.barWidth;
    var h = options.size.barHeight;
    var ctx = options.context;
    ctx.fillStyle = 'rgba(0, 0, 0, ' + opacity.toFixed(3) + ')';
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(-w / 2, 0);
    ctx.lineTo(-w / 2, h - (w / 2));
    ctx.quadraticCurveTo(-w / 2, h, 0, h);
    ctx.quadraticCurveTo(w / 2, h, w / 2, h - (w / 2));
    ctx.fill();
  }
  /**
   * Calculate the x and y position of a bar.
   *
   * @param  {Object} options Throbber options
   * @param  {Number} barNo The index of the bar to be drawn
   * @return {Object}         An object containing the angle and x and y starting positions of the bar
   */
  function calculatePosition(options, barNo) {
    var angle = 2 * barNo * Math.PI / options.bars;
    return {
        x: (options.innerRadius * Math.sin(-angle)),
        y: (options.innerRadius * Math.cos(-angle)),
        angle: angle
    };
  }

  /**
   * Draw the throbber.
   * @param  {Object} options
   */
  function draw(options) {
    var ctx = options.context;
    var i;
    var pos;
    var delta = new Date() - startAnimationTime;
    var opacityOffset = delta / (60000 / Throbber.options.rpm); // how many revolutions have we done so far
    var opacity;

    ctx.clearRect(0, 0, options.size.canvas, options.size.canvas);
    ctx.save();
    ctx.scale(options.scale, options.scale);
    ctx.translate(options.center.x, options.center.y);
    for (i = 0; i < options.bars; ++i) {
      opacity = 1 - (((options.bars - i) / options.bars + opacityOffset) % 1);
      pos = calculatePosition(options, i);
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(pos.angle);
      drawBar(options, opacity);
      ctx.restore();
    }
    ctx.restore();
  }

  /**
   * Function which is called on each rendering tick by requestAnimationFrame
   */
  function tick() {
    var i;
    var length = Throbber.active.length;

    ++gcCounter;

    if (length && gcCounter % GC_INTERVAL === 0) {
      // time to clean up orphaned canvases
      for (i = length - 1; i >= 0; --i) {
        if (!Throbber.active[i].isInDocument()) {
          Throbber.active[i].stop();
        }
      }
      length = Throbber.active.length;
    }

    if (length) {
      requestAnimationFrame(tick);
      for (i = 0, length = Throbber.active.length; i < length; ++i) {
        draw(Throbber.active[i].options);
      }
    } else {
      gcCounter = 0;
      startAnimationTime = null;
    }
  }

  /**
   * Modify the object passed as `options` to set it up correctly given the type and canvas element.
   * @param {Object} options
   * @param {Canvas} canvas
   * @param {String=} type Optional type string. Currently only supports 'small'.
   */
  function setUpOptions(options, canvas, type) {
    if (type === 'small') {
      options.innerRadius = 3;
      options.center = {
        x: 10,
        y: 10
      };
      options.size = {
        barWidth: 2,
        barHeight: 5,
        canvas: 20
      };
    }
    options.context = canvas.getContext('2d');
    options.scale = 1;

    // double the dimension of the canvas for high dpi displays
    if (window.devicePixelRatio >= 1.5) {
      options.size.canvas *= 2;
      options.scale = 2;
    }
    options.context.canvas.width = options.context.canvas.height = options.size.canvas;
  }

  /**
   * The Throbber handle class. This holds the information about a single throbber, and contains methods to control or
   * inspect it. An instance of this class is returned by `Throbber.start()`
   *
   * @class
   * @param {Object} options Configuration options
   */
  Handle = function (options) {
    this.options = options;
  };

  /**
   * Stops and destroys a throbber, removing its canvas from the document
   */
  Handle.prototype.stop = function() {
    var i;
    var canvas;
    if (!this.isActive()) {
      // this has already been stopped.
      return;
    }

    // remove this throbber from the active list
    for (i = Throbber.active.length - 1; i >= 0; i--) {
      if (Throbber.active[i] === this) {
        Throbber.active.splice(i, 1);
        break;
      }
    }

    if (Throbber.active.length === 0) {
      startAnimationTime = null;
    }

    // destroy the canvas element
    canvas = this.options.context.canvas;
    if (canvas.parentNode) {
      canvas.parentNode.removeChild(canvas);
    }
    this.options = null;

  };

  /**
   * Returns true if this Throbber is using the supplied canvas element
   * @param  {Canvas} canvas  A Canvas DOMElement
   * @return {Boolean}
   */
  Handle.prototype.uses = function(canvas) {
    return canvas === this.options.context.canvas;
  };

  /**
   * Whether this throbber is currently active.
   * @return {Boolean}
   */
  Handle.prototype.isActive = function () {
    return this.options !== null;
  };

  Handle.prototype.isInDocument = function () {
    var canvas = this.options.context.canvas;
    var el = canvas;
    while ((el = el.parentNode)) {
      if (el.nodeName.toLowerCase() === 'html') {
        return true;
      }
    }
    return false;
  };

  /**
   * The Throbber singleton class
   */
  Throbber = {
    options : {
      bars : 12,
      innerRadius : 8,
      center : {x: 20, y: 20},
      size : {barWidth: 3, barHeight:8, canvas: 40},
      // throbber revolutions per minute
      rpm : 60
    },
    active : [], // array of active throbbers

    /**
     * Start a single Throbber in the given location.
     *
     * The location is determined by the selector, which can be given in one of two forms:
     *
     * - DOMElement
     *    - Canvas element: This canvas will be used to draw the throbber
     *    - Any other type of element: A canvas will be appended to this element.
     * - jQuery result set
     *    - The result of a jQuery query. **Only the first element will be used**.
     *
     * Returns a handle which allows you to stop the given throbber. Calling `start` on the same element multiple times
     * will simply reuse the same canvas (in effect, nothing happens).
     *
     * @param  {DOMElement|jQuery} selector
     * @param  {String=} opt_type Optional type for this throbber. Currently only supports 'small' or regular. Leave blank
     *                            for regular.
     * @return {ThrobberHandle}
     */
    start: function(selector, opt_type) {
      // clone options to avoid over-writing them for small throbber.
      var options = extend(this.options);
      var handle;
      var canvas;
      var i;
      var l;

      canvas = getCanvas(selector);

      // could not find/create a canvas in the selector
      if (!canvas || !canvas.getContext) {
        return;
      }

      // check if the given selector already has an active throbber going
      for (i = 0, l = Throbber.active.length; i < l; ++i) {
        if (Throbber.active[i].uses(canvas)) {
          return Throbber.active[i];
        }
      }

      setUpOptions(options, canvas, opt_type);

      handle = new Handle(options);
      this.active.push(handle);

      // if no animations are currently running, kick them off
      if (startAnimationTime === null) {
        startAnimationTime = +(new Date());
        requestAnimationFrame(tick);
      }

      return handle;
    },
    /**
     * Stop the most-recently started Throbber.
     */
    stop: function() {
      var lastActive = this.active[this.active.length - 1];
      if (lastActive) {
        lastActive.stop();
      }
    },
    /**
     * Stop all currently active throbbers.
     */
    stopAll : function () {
      for (var i = this.active.length - 1; i >= 0; i--) {
        this.active[i].stop();
      }
    },
    /**
     * Switches Throbber between using `setTimeout` based animation and `requestAnimationFrame`.
     * @param  {Boolean} flag If true, `setTimeout` will be used. If `false`, then `requestAnimationFrame`.
     */
    useLegacyAnimation : function (flag) {
      var legacy = function(callback) {
        window.setTimeout(callback, 1000 / 60);
      };
      if (!flag) {
        /**
         * Polyfill for window.requestAnimationFrame
         * https://developer.mozilla.org/en/DOM/window.mozRequestAnimationFrame
         * @param {Function} callback FrameRequestCallback
         */
        requestAnimationFrame =
            window.requestAnimationFrame ||
            window.webkitRequestAnimationFrame ||
            // comment out if FF4 is slow (https://bugzilla.mozilla.org/show_bug.cgi?id=630127)
            window.mozRequestAnimationFrame ||
            window.oRequestAnimationFrame ||
            window.msRequestAnimationFrame ||
            legacy;
      } else {
        requestAnimationFrame = legacy;
      }
    }
  };

  Throbber.useLegacyAnimation(false);

  /////////////////////
  //  jQuery plugin  //
  /////////////////////
  if (window.jQuery) {
    /**
     * Start Throbbers for each of the given set of elements. If the element itself is a canvas, it will become a
     * throbber, otherwise a throbber is appended to that element.
     *
     * @return {jQuery}
     */
    window.jQuery.fn.throbber = function () {
      return this.each(function () {
        Throbber.start(this);
      });
    };
  }

  return Throbber;
}());
