import ws from 'k6/ws';
import { check } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';

const SERVER_URL = __ENV.SERVER_URL || 'ws://localhost:3000';
const ROOMS = Number(__ENV.ROOMS || 5);
const USERS_PER_ROOM = Number(__ENV.USERS_PER_ROOM || 4);
const HOLD_MS = Number(__ENV.HOLD_MS || 3000);

const joinLatency = new Trend('join_room_latency_ms', true);
const joinErrors = new Counter('join_room_errors');
const joinSuccess = new Rate('join_room_success_rate');

export const options = {
	scenarios: {
		ramp: {
			executor: 'ramping-vus',
			startVUs: 0,
			stages: [
				{ duration: '5s', target: ROOMS * USERS_PER_ROOM },
				{ duration: '10s', target: ROOMS * USERS_PER_ROOM },
				{ duration: '2s', target: 0 }
			],
			gracefulRampDown: '5s'
		}
	},
	thresholds: {
		join_room_success_rate: ['rate>0.95'],
		join_room_latency_ms: ['p(95)<2000', 'p(99)<5000']
	}
};

export default function () {
	const vu = __VU;
	const roomIdx = Math.floor((vu - 1) / USERS_PER_ROOM);
	const userIdx = (vu - 1) % USERS_PER_ROOM;
	const roomId = `load-room-${roomIdx}`;
	const name = `user-${roomIdx}-${userIdx}`;

	const url = `${SERVER_URL}/socket.io/?EIO=4&transport=websocket`;
	let joinStart = 0;
	let resolved = false;

	const settle = (ok, reason) => {
		if (resolved) return;
		resolved = true;
		joinSuccess.add(ok);
		if (!ok) joinErrors.add(1, { reason: reason || 'unknown' });
	};

	const res = ws.connect(url, {}, function (socket) {
		socket.setTimeout(() => {
			settle(false, 'timeout');
			socket.close();
		}, 10_000);

		socket.on('message', (raw) => {
			if (raw.startsWith('0')) {
				socket.send('40');
				return;
			}
			if (raw.startsWith('40')) {
				joinStart = Date.now();
				const payload = JSON.stringify(['join-room', { roomId, name }]);
				socket.send(`421${payload}`);
				return;
			}
			if (raw.startsWith('431')) {
				const latency = Date.now() - joinStart;
				let parsed;
				try {
					parsed = JSON.parse(raw.slice(3));
				} catch {
					settle(false, 'parse-error');
					socket.close();
					return;
				}
				const ack = parsed[0];
				if (ack && ack.error) {
					settle(false, ack.error);
				} else {
					joinLatency.add(latency);
					settle(true);
				}
				socket.setTimeout(() => socket.close(), HOLD_MS);
			}
		});

		socket.on('error', (e) => {
			settle(false, `ws-error:${e?.error || e}`);
			socket.close();
		});
	});

	check(res, { 'websocket upgraded': (r) => r && r.status === 101 });
}
