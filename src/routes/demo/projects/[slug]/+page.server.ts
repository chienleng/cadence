import { error } from '@sveltejs/kit';
import { getProjectDetail } from '$workspace-provider';

export async function load({ params }) {
	const detail = await getProjectDetail(params.slug);
	if (!detail) error(404, 'Project not found');
	return detail;
}
