import { listGithubOrgs } from "../../src/scripts/github/list-orgs";
import { listGithubRepos } from "../../src/scripts/github/list-repos";

describe('listGithubOrgs script', () => {
  const OLD_ENV = process.env;
  const GITHUB_ORG_NAME = process.env.TEST_GH_ORG_NAME;
  process.env.GITHUB_TOKEN = process.env.GH_TOKEN;

  afterAll(async () => {
    process.env = { ...OLD_ENV };
  });
  it('list orgs', async () => {
    const orgs = await listGithubOrgs();
    expect(orgs[0]).toEqual({
      name: expect.any(String),
      id: expect.any(Number),
      url: expect.any(String)
    });
  });
  it('list repos', async () => {
    const orgs = await listGithubRepos(GITHUB_ORG_NAME as string);
    expect(orgs[0]).toEqual({
      name: expect.any(String),
      owner: expect.any(String),
      branch: expect.any(String),
      fork: expect.any(Boolean),
    });
  });
});