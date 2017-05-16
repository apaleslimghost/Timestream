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

	merge(other) {
		const self = this;

		return new TimeStream(function* () {
			const selfGen = self[Symbol.iterator]();
			const otherGen = other[Symbol.iterator]();

			let iterateSelf = true;
			let iterateOther = true;
			let overrideSelf = false;
			let overrideOther = false;

			while(true) {
				if(overrideSelf) {
					iterateSelf = false;
					selfEvent = overrideSelf;
					overrideSelf = false;
				}

				if(overrideOther) {
					iterateOther = false;
					otherEvent = overrideOther;
					overrideOther = false;
				}

				if(iterateSelf) {
					var {done: selfDone, value: selfEvent} = selfGen.next();
				}

				if(iterateOther) {
					var {done: otherDone, value: otherEvent} = otherGen.next();
				}

				if(selfDone) {
					if(otherDone) break;

					iterateSelf = false;
					iterateOther = true;
					continue;
				}

				if(otherDone) {
					iterateSelf = true;
					iterateOther = false;
					continue;
				}

				switch(selfEvent.constructor) {
					case Value:
						yield selfEvent;

						switch(otherEvent.constructor) {
							case End:
								iterateSelf = true;
								iterateOther = false;
								continue;
							default:
								yield otherEvent;
								iterateSelf = iterateOther = true;
								continue;

						}

					case Interval:
						switch(otherEvent.constructor) {
							case Value:
								yield selfEvent;
								yield otherEvent;
								iterateSelf = iterateOther = true;
								continue;
							case Interval:
								// same interval, so coalesce following event
								if(selfEvent.data === otherEvent.data) {
									yield selfEvent;
									iterateSelf = iterateOther = true;
									continue;
								}

								// we want the shortest interval, then iterate whatever
								// comes next, with the other stream's head replaced
								// with the remaining interval
								if(selfEvent.data < otherEvent.data) {
									yield selfEvent;
									overrideOther = new Interval(otherEvent.data - selfEvent.data);
									iterateSelf = true;
									iterateOther = false;
									continue;
								}

								if(otherEvent.data < selfEvent.data) {
									yield otherEvent;
									overrideSelf = new Interval(selfEvent.data - otherEvent.data);
									iterateSelf = false;
									iterateOther = true;
									continue;
								}
							case End:
								yield selfEvent;
								iterateSelf = true;
								iterateOther = false;
								continue;
						}

					case End:
						yield otherEvent;
						iterateSelf = false;
						iterateOther = true;

						if(otherEvent instanceof End) break;
						else continue;
				}
			}
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
	'kick',
	new Interval(500),
	'kick',
	new Interval(500),
	'kick',
	new Interval(500),
	'kick',
	new Interval(500),
]);

const bar = TimeStream.fromArray([
	'snare',
	new Interval(250),
	'snare',
	new Interval(250),
	'snare',
	new Interval(250),
	'snare',
	new Interval(250),
	'snare',
	new Interval(250),
	'snare',
	new Interval(250),
	'snare',
	new Interval(250),
	'snare',
	new Interval(250),
]);

foo.merge(bar).consumeWithTime(console.log);
