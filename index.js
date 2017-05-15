const struct = require('@quarterto/struct');
const {setHrTimeout} = require('@quarterto/hr-timeout');
const subtractHrtime = require('@quarterto/subtract-hrtime');
const msToHrtime = require('@quarterto/ms-to-hrtime');

class Event extends struct('time', 'data') {
	delay(amt) {
		return new this.constructor(this.time + amt, this.data);
	}
}
class Next extends Event {}
class Stop extends Event {}

const generatorToIterable = iter => typeof iter === 'function' ? iter() : iter;
const iterableToIterator = iter => iter[Symbol.iterator] || iter;

class TimeStream extends struct('generator') {
	static fromArray(arr) {
		return new TimeStream(
			arr.map((x, i) => new (i === arr.length - 1 ? Stop : Next)(...x))
		);
	}

	map(fn) {
		const self = this;
		return new TimeStream(function* () {
			yield* self.run(event => fn(event));
		});
	}

	delay(amt) {
		return this.map(event => event.delay(amt));
	}

	concat(other) {
		const self = this;
		return new TimeStream(function* () {
			let end;
			yield* self.run(event => {
				switch(event.constructor) {
					case Next:
						return event;
					case Stop:
						end = event.time;
						return new Next(event);
				}
			});

			yield* other.delay(end);
		});
	}

	[Symbol.iterator]() {
		return this.run(e => e);
	}

	*run(sink) {
		for(const event of generatorToIterable(this.generator)) {
			yield sink(event);
			if(event instanceof Stop) return;
		}
	}

	consume(sink) {
		for(const event of this) {
			sink(event);
		}
	}

	consumeWithTime(sink) {
		const gen = this[Symbol.iterator]();
		const start = Date.now();

		function loop() {
			let {done, value: {time, data} = {}} = gen.next();

			if(done) return;

			const sinceStart = Date.now() - start;
			const delay = time - sinceStart;

			setTimeout(() => {
				sink(data);
				loop();
			}, delay);
		}

		loop();
	}
}

const foo = TimeStream.fromArray([
	[0,    'a'],
	[1000, 'b'],
	[2000, 'c'],
	[3000, 'd'],
	[4000, 'e'],
]);

const bar = TimeStream.fromArray([
	[0,    'f'],
	[1000, 'g'],
	[2000, 'h'],
	[3000, 'i'],
	[4000, 'j'],
]);

foo.concat(bar.delay(1000)).consumeWithTime(console.log);
