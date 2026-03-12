/**
 * GitHub Stars API Route
 * GET /api/github/:owner/:repo/stars
 */

import { defineHandler, getRouterParam, HTTPError } from 'nitro/h3';

export default defineHandler(async event => {
	const owner = getRouterParam(event, 'owner');
	const repo = getRouterParam(event, 'repo');

	if (!owner || !repo) {
		throw new HTTPError('Owner and repo parameters are required', { status: 400 });
	}

	try {
		const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
			headers: {
				Accept: 'application/vnd.github.v3+json',
				'User-Agent': 'Avalon-Demo',
			},
		});

		if (!response.ok) {
			throw new Error(`GitHub API error: ${response.status}`);
		}

		const data = await response.json();

		return {
			owner,
			repo,
			stars: data.stargazers_count,
			fetchedAt: new Date().toISOString(),
		};
	} catch (error) {
		throw new HTTPError(`Failed to fetch GitHub data: ${error instanceof Error ? error.message : 'Unknown error'}`, {
			status: 502,
		});
	}
});
