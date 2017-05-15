const struct = require('@quarterto/struct');
const {setHrTimeout} = require('@quarterto/hr-timeout');
const subtractHrtime = require('@quarterto/subtract-hrtime');
const msToHrtime = require('@quarterto/ms-to-hrtime');

const Event = struct('data');
class Value extends Event {}
class Interval extends Event {}
class End extends Event {
	constructor() {
		super(null);
	}
}

const generatorToIterable = iter => typeof iter === 'function' ? iter() : iter;
const iterableToIterator = iter => iter[Symbol.iterator] || iter;

class TimeStream extends struct('generator') {
	static fromArray(arr) {
		return new TimeStream(
			arr.map(
				x => x instanceof Event ? x : new Value(x)
			).concat(new End())
		);
	}

	map(fn) {
		const self = this;
		return new TimeStream(function* () {
			yield* self.run(event => fn(event));
		});
	}

	delay(amt) {
		return new TimeStream([
			new Interval(amt)
		]).concat(this);
	}

	endless() {
		const self = this;
		return new TimeStream(function* () {
			for(const event of self) {
				if(!(event instanceof End)) yield event;
			}
		});
	}

	concat(other) {
		const self = this;
		return new TimeStream(function* () {
			yield* self.endless();
			yield* other;
		});
	}

	[Symbol.iterator]() {
		return this.run(e => e);
	}

	*run(sink) {
		for(const event of generatorToIterable(this.generator)) {
			yield sink(event);
			if(event instanceof End) return;
		}
	}

	consume(sink) {
		for(const event of this) {
			sink(event.data);
		}
	}

	consumeWithTime(sink) {
		const gen = this[Symbol.iterator]();

		function loop() {
			let {done, value} = gen.next();
			if(done) return;

			switch(value.constructor) {
				case Interval:
					return setTimeout(() => {
						loop();
					}, value.data);
				case Value:
					sink(value.data);
					return loop();
				case End:
					return;
			}
		}

		loop();
	}
}

const foo = TimeStream.fromArray([
	'a',
	new Interval(1000),
	'b',
	new Interval(1000),
	'c',
	new Interval(1000),
	'd',
	new Interval(1000),
	'e',
	new Interval(1000),
]);

const bar = TimeStream.fromArray([
	'f',
	new Interval(1000),
	'g',
	new Interval(1000),
	'h',
	new Interval(1000),
	'i',
	new Interval(1000),
	'j',
	new Interval(1000),
]);

foo.concat(bar).consumeWithTime(console.log);
