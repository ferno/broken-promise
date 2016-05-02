/**
	Sketchy Promises/A+ implementation. Approximately one working day of work.
*/

"use strict";

var PENDING = 0;
var FULFILLED = 1;
var REJECTED = 2;

/** Promise constructor */
module.exports = function(asyncOp) {
	/** A promise can be pending, fulfilled or rejected. */
	this._state = PENDING;

	/**
		If fulfilled, the promise has a value; if rejected, it has a reason. We
		use this member to store either.
	*/
	this._value = undefined; // Note that `undefined` is a perfectly legal value/reason
	
	/**
		Any time `then` is called on this `Promise`, a new promise will be returned.
		If the current `Promise` ever settles, then the second promise must also be
		settled with the same value or reason. We call these child `Promise`s
		"deferreds". They also have to be settled in the right order, but we get
		that for free.
	*/
	this._deferreds = [];

	/**
		Call this to immediately fulfill or reject this promise with the given
		value or reason. This has a cascading effect on deferred child promises.
	*/
	this._settle = function(state, value) {
		if(this._state === PENDING) { // 2.1.1
			this._value = value; // 2.1.2.2
			this._state = state; // 2.1.1.1
			this._deferreds.forEach(
				promise2 => promise2.settleDeferred(this._state, this._value)
			); // 2.2.6.1
		}
	};

	/**
		If we are ourselves a deferred child of a parent promise, then this method
		will be called when that parent promise settles or, if we were created
		attached to an already-settled promise (using `then`), immediately on
		creation.
	*/
	this.on = {};
	this.settleDeferred = function(state, value) {
		setTimeout(() => {
			var onSettled = this.on[state]; // 2.2.5
			if(typeof onSettled !== "function") { // 2.2.2
				this._settle(state, value); // 2.2.7.3
				return;
			}
			var x;
			try {
				x = onSettled(value); // 2.2.2.1
			} catch(e) {
				this._settle(REJECTED, e); // 2.2.7.2
				return;
			}
			this._RESOLVE(x); // 2.2.7.1
		}, 0); // 2.2.2.2
	};

	/**
		The Promise Resolution Procedure.
		Figure out how to settle this promise, given a value `x` to settle it
		with. In general, if `x` is a regular value then we resolve with `x`.
		If `x` is another promise then we settle THE SAME WAY AS `x`.
		If anything goes wrong then we reject with the error.
		
		Note that there is nothing wrong with FULFILLING an ordinary promise with
		a value which is another promise. This routine is different from that. It is
		only called when we are a deferred child promise, and a parent has passed
		`x` down to us.
	*/
	this._RESOLVE = function(x) {
		if(this === x) {
			this._settle(REJECTED, TypeError()); // 2.3.1
			return;
		}

		if((typeof x !== "object" || x === null) && typeof x !== "function") { // 2.3.3
			this._settle(FULFILLED, x); // 2.3.4
			return;
		}

		var then;
		try {
			then = x.then; // 2.3.3.1
		} catch(e) {
			this._settle(REJECTED, e); // 2.3.3.2
			return;
		}

		if(typeof then !== "function") {
			this._settle(FULFILLED, x); // 2.3.3.4
			return;
		}

		// 2.3.3.3
		var settled = false;
		var resolvePromise = y => {
			if(!settled) { // 2.3.3.3.3
				settled = true;
				this._RESOLVE(y);
			}
		}; // 2.3.3.3.1

		var rejectPromise = r => {
			if(!settled) { // 2.3.3.3.3
				settled = true;
				this._settle(REJECTED, r);
			}
		}; // 2.3.3.3.2

		try {
			then.bind(x)(resolvePromise, rejectPromise);
		} catch(e) { // 2.3.3.3.4
			if(!settled) { // 2.3.3.3.4.1
				this._settle(REJECTED, e); // 2.3.3.3.4.2
			}
		}
	};

	this.then = function(onFulfilled, onRejected) {
		var promise2 = new module.exports();
		promise2.on[FULFILLED] = onFulfilled;
		promise2.on[REJECTED] = onRejected;
		
		if(this._state === PENDING) {
			this._deferreds.push(promise2);
		} else {
			promise2.settleDeferred(this._state, this._value);
		}

		return promise2; // 2.2.7
	};

	// OH AND ALSO DO SOME WORK. Note that a regular promise will never fulfill
	// or reject unless we do this. However, a deferred child promise (such as
	// created when we call `then`) is generally fulfilled or rejected by an
	// external force i.e. the parent promise.
	if(typeof asyncOp === "function") {
		asyncOp(
			value => this._settle(FULFILLED, value),
			value => this._settle(REJECTED, value)
		);
	}
	// In fact this whole section is totally optional. There is absolutely no
	// reason why you can't just work exclusively with bare promises and fulfill
	// or reject them manually using whatever methods were provided.
};