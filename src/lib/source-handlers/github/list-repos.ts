import { Octokit } from '@octokit/rest';
import * as debugLib from 'debug';
import { getGithubToken } from './get-github-token';
import { getGithubBaseUrl } from './github-base-url';
import { GithubRepoData } from './types';
import { SourceRepoOptions } from '../../types';

const debug = debugLib('snyk:list-repos-script');

export async function fetchReposForPage(
  octokit: Octokit,
  orgName: string,
  parentOrganization?: string,
  pageNumber = 1,
  perPage = 100,
): Promise<{
  repos: GithubRepoData[];
  hasNextPage: boolean;
}> {
  const repoData: GithubRepoData[] = [];
  let res;
  if (parentOrganization) {
    const params = {
      per_page: perPage,
      page: pageNumber,
      org: parentOrganization,
      team_slug: orgName,
    };
    res = await octokit.teams.listReposInOrg(params);
  } else {
    const params = {
      per_page: perPage,
      page: pageNumber,
      org: orgName,
    };
    res = await octokit.repos.listForOrg(params);
  }
  const repos = res && res.data;
  let hasNextPage;
  if (repos.length) {
    hasNextPage = true;
    repoData.push(
      ...repos
        .filter((repo) => !repo.archived)
        .map((repo) => ({
          fork: repo.fork,
          name: repo.name,
          owner: repo.owner?.login,
          branch: repo.default_branch,
        })),
    );
  } else {
    hasNextPage = false;
  }
  return { repos: repoData, hasNextPage };
}

async function fetchAllRepos(
  octokit: Octokit,
  orgName: string,
  parentOrganization?: string,
  page = 1,
): Promise<GithubRepoData[]> {
  const repoData: GithubRepoData[] = [];
  const MAX_RETRIES = 3;

  let currentPage = page;
  let hasMorePages = true;
  let retries = 0;
  while (hasMorePages) {
    try {
      debug(`Fetching page: ${currentPage}`);
      const { repos, hasNextPage } = await fetchReposForPage(
        octokit,
        orgName,
        parentOrganization,
        currentPage,
      );
      retries = 0;
      currentPage = currentPage + 1;
      hasMorePages = hasNextPage;
      repoData.push(...repos);
    } catch (e) {
      debug(`Failed to fetch page: ${currentPage}`, e);
      if ([403, 500, 502].includes(e.status) && retries < MAX_RETRIES) {
        const sleepTime = 120000 * retries; // 2 mins x retry attempt
        retries = retries + 1;
        console.error(`Sleeping for ${sleepTime} ms`);
        await new Promise((r) => setTimeout(r, sleepTime));
      } else {
        throw e;
      }
    }
  }
  return repoData;
}

export async function listGithubRepos(options: SourceRepoOptions): Promise<GithubRepoData[]> {
  const { orgName, host, parentOrganization } = options;
  const githubToken = getGithubToken();
  const baseUrl = getGithubBaseUrl(host);
  const octokit: Octokit = new Octokit({ baseUrl, auth: githubToken });
  debug(`Fetching all repos data for org: ${orgName}`);
  return await fetchAllRepos(octokit, orgName, parentOrganization);
}
