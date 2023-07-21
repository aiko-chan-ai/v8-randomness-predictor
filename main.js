const z3 = require('z3-solver');

async function main(sequence) {
	sequence = sequence.reverse();
	if (sequence.length < 2) {
		throw new Error('sequence must have at least 2 elements');
	}
	const { Context } = await z3.init();
	const ctx = new Context('main');
	const { BitVec, Solver, Int } = ctx;
	const solver = new Solver();
	let [se_state0, se_state1] = BitVec.consts(['se_state0', 'se_state1'], 64);
	for (let i = 0; i < sequence.length; i++) {
		// XorShift128+
		let se_s1 = se_state0;
		let se_s0 = se_state1;
		se_state0 = se_s0;
		se_s1 = se_s1.xor(se_s1.shl(23));
		se_s1 = se_s1.xor(se_s1.lshr(17));
		se_s1 = se_s1.xor(se_s0);
		se_s1 = se_s1.xor(se_s0.lshr(26));
		se_state1 = se_s1;

		// Convert sequence[i] to IEEE 754 double-precision binary floating-point format
		const float64Buffer = Buffer.allocUnsafe(8);
		float64Buffer.writeDoubleLE(sequence[i] + 1, 0);
		const uLongLong64 = float64Buffer.readBigUInt64LE();

		// Get the lower 52 bits (mantissa)
		const mantissa = uLongLong64 & BigInt('0x000FFFFFFFFFFFFF');

		solver.add(ctx.Eq(BitVec.val(mantissa, 64), se_state0.lshr(12)));
	}
	if ((await solver.check()) !== 'sat') {
		throw new Error("Couldn't find a solution");
	}
	const model = solver.model();
	const states = {};
	for (const func of model.decls()) {
		states[func.name()] = model.get(func).value();
	}
	console.log('Debug:', states);
	const state0 = states['se_state0'];
	// Extract mantissa
	// Add 1.0 (+ 0x3FF0000000000000) to 52 bits
	// Get the double and subtract 1 to obtain the random number between [0, 1)
	const uLongLong64 = (state0 >> BigInt(12)) | BigInt('0x3FF0000000000000');
	const float64Buffer = Buffer.allocUnsafe(8);
	float64Buffer.writeBigUInt64LE(uLongLong64, 0);
	let nextSequence = float64Buffer.readDoubleLE(0);
	nextSequence -= 1;
	return nextSequence;
}

async function test() {
	// const random = Array.from(Array(5), Math.random);
	const random = [
		0.9311600617849973, 0.3551442693830502, 0.7923158995678377,
		0.787777942408997, 0.376372264303491,
	];
	// const actualNextSequence = Math.random();
	const actualNextSequence = 0.23137147109312428;
	console.log('Seeds:', random);
	console.log('Actual next sequence:', actualNextSequence);
	try {
		const nextSequence = await main(random);
		console.log('Predicted next sequence:', nextSequence);
	} catch (e) {
		console.log(e);
	}
	process.exit(0);
}

test();
