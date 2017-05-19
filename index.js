const struct = require('@quarterto/struct');
const {setHrTimeout} = require('@quarterto/hr-timeout');
const subtractHrtime = require('@quarterto/subtract-hrtime');
const msToHrtime = require('@quarterto/ms-to-hrtime');

const Event = struct('data', 'delay');

const generatorToIterable = iter => typeof iter === 'function' ? iter() : iter;
const iterableToIterator = iter => iter[Symbol.iterator] || iter;

const mergeCumulative = (a, b) => Array.from({length: a.length + b.length}, (_, i) => {
	if(a[0] && a[0].delay <= b[0].delay) {
		return a.shift();
	}

	return b.shift();
});

class TimeStream extends struct('generator') {
	static fromArray(arr) {
		return new TimeStream(
			arr.map(
				x => x instanceof Event ? x : new Event(...x)
			)
		);
	}

	static fromCumulative(events) {
		let marker = 0;
		return new TimeStream(function*() {
			for(const {data, delay} of events) {
				yield new Event(data, delay - marker);
				marker = delay;
			}
		});
	}

	map(fn) {
		const self = this;
		return new TimeStream(function* () {
			yield* self.run(event => fn(event));
		});
	}

	delay(amt) {
		const iter = this[Symbol.iterator]();
		return new TimeStream(function*() {
			const first = iter.next();
			first.delay += amt;
			yield first;
			yield* iter;
		});
	}
	concat(other) {
		const self = this;
		return new TimeStream(function* () {
			yield* self;
			yield* other;
		});
	}

	toCumulative() {
		return Array.from(this).reduce(
			(events, event, i) => events.concat(Object.assign(event, {
				delay: (events[i - 1] ? events[i - 1].delay : 0) + event.delay
			})),
			[]
		);
	}

	merge(other) {
		return TimeStream.fromCumulative(
			mergeCumulative(
				this.toCumulative(),
				other.toCumulative()
			)
		);
	}

	[Symbol.iterator]() {
		return this.run(e => e);
	}

	*run(sink) {
		for(const event of generatorToIterable(this.generator)) {
			yield sink(event);
		}
	}

	consume(sink) {
		for(const event of this) {
			sink(event.data);
		}
	}

	forEach(fn) {
		for(const event of this) {
			fn(event);
		}
	}

	consumeWithTime(sink) {
		const gen = this[Symbol.iterator]();

		function loop() {
			const {done, value} = gen.next();
			if(done) return;
			const {data, delay} = value;

			setTimeout(() => {
				sink(data);
				loop();
			}, delay);
		}

		loop();
	}
}

const foo = TimeStream.fromArray([
	['kick', 1000],
	['kick', 1000],
	['kick', 1000],
	['kick', 1000],
]);

const bar = TimeStream.fromArray([
	['snare', 500],
	['snare', 500],
	['snare', 500],
	['snare', 500],
	['snare', 500],
	['snare', 500],
	['snare', 500],
	['snare', 500],
]);

foo.merge(bar).consumeWithTime(console.log.bind(console, '→'));
