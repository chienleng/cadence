import { error } from '@sveltejs/kit';
import { getProjectDetail } from '$workspace-provider';

export async function load({ params, url }) {
	const detail = await getProjectDetail(params.slug, {
		record: url.searchParams.get('record'),
		document: url.searchParams.get('document')
	});
	if (!detail) error(404, 'Project not found');
	return detail;
}
