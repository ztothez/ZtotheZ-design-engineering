export type ReleaseAsset = { name: string; creator: string; licence: string; confirmed: boolean };
export const assetUnresolved = (asset: ReleaseAsset) => !asset.confirmed || !asset.name.trim() || !asset.creator.trim() || !asset.licence.trim();

export function createReleaseReadme(title: string, aiDisclosure: string, assets: ReleaseAsset[]) {
  return [
    `Production: ${title.trim() || 'Not supplied'}`,
    'Run: Open the exported HTML in a browser, choose Play, and use Escape to pause.',
    'Requirements: A browser with Canvas support. The exported production has no external playback dependencies.',
    `AI disclosure: ${aiDisclosure.trim() || 'Not supplied; review before release'}`,
    '', 'Assets and credits:',
    ...(assets.length ? assets.flatMap((asset, index) => [
      `${index + 1}. ${asset.name.trim() || 'Unnamed asset'}`,
      `Creator: ${asset.creator.trim() || 'Not supplied'}`,
      `Licence: ${asset.licence.trim() || 'Not supplied'}`,
      `Rights: ${assetUnresolved(asset) ? 'UNRESOLVED' : 'User-confirmed; not independently verified'}`,
    ]) : ['No external assets declared.']),
    '', `${assets.filter(assetUnresolved).length} unresolved asset entries.`,
    'SceneStart does not certify originality, authorship, rights ownership, or official competition eligibility.', '',
  ].join('\n');
}
