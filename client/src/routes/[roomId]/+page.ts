import type { PageLoad } from './$types';

export const load = (({ params }) => {
	const { roomId } = params;

	return {
		roomId
	};
}) satisfies PageLoad;
