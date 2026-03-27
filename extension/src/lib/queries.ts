/** GraphQL documents for [contracts/github-graphql.md](../../specs/001-cross-org-board-ui/contracts/github-graphql.md) */

export const QUERY_VIEWER = `
  query Viewer {
    viewer {
      login
    }
  }
`

export const QUERY_PROJECT_V2 = `
  query ProjectV2Id($org: String!, $number: Int!) {
    organization(login: $org) {
      projectV2(number: $number) {
        id
        title
        url
      }
    }
  }
`

export const QUERY_ISSUE_NODE_ID = `
  query RepoIssueId($owner: String!, $name: String!, $number: Int!) {
    repository(owner: $owner, name: $name) {
      issue(number: $number) {
        id
      }
    }
  }
`

export const QUERY_PR_NODE_ID = `
  query RepoPullRequestId($owner: String!, $name: String!, $number: Int!) {
    repository(owner: $owner, name: $name) {
      pullRequest(number: $number) {
        id
      }
    }
  }
`

export const QUERY_NODE_PROJECT_ITEMS = `
  query NodeProjectItems($id: ID!) {
    node(id: $id) {
      ... on Issue {
        id
        projectItems(first: 100) {
          nodes {
            id
            project {
              ... on ProjectV2 {
                id
                title
                url
                number
                owner {
                  ... on Organization { login }
                  ... on User { login }
                }
              }
            }
            fieldValues(first: 40) {
              nodes {
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                  field {
                    ... on ProjectV2SingleSelectField {
                      name
                    }
                  }
                }
                ... on ProjectV2ItemFieldNumberValue {
                  number
                  field {
                    ... on ProjectV2Field {
                      name
                    }
                  }
                }
                ... on ProjectV2ItemFieldTextValue {
                  text
                  field {
                    ... on ProjectV2Field {
                      name
                    }
                  }
                }
              }
            }
          }
        }
      }
      ... on PullRequest {
        id
        projectItems(first: 100) {
          nodes {
            id
            project {
              ... on ProjectV2 {
                id
                title
                url
                number
                owner {
                  ... on Organization { login }
                  ... on User { login }
                }
              }
            }
            fieldValues(first: 40) {
              nodes {
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                  field {
                    ... on ProjectV2SingleSelectField {
                      name
                    }
                  }
                }
                ... on ProjectV2ItemFieldNumberValue {
                  number
                  field {
                    ... on ProjectV2Field {
                      name
                    }
                  }
                }
                ... on ProjectV2ItemFieldTextValue {
                  text
                  field {
                    ... on ProjectV2Field {
                      name
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`

/** Paginate project board items to find the card for an Issue/PR node id (R3 fallback). */
export const QUERY_PROJECT_V2_ITEMS_PAGE = `
  query ProjectV2ItemsPage($projectId: ID!, $after: String) {
    node(id: $projectId) {
      ... on ProjectV2 {
        items(first: 100, after: $after) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            id
            project {
              ... on ProjectV2 {
                id
                title
                url
              }
            }
            content {
              ... on Issue {
                id
              }
              ... on PullRequest {
                id
              }
            }
            fieldValues(first: 40) {
              nodes {
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                  field {
                    ... on ProjectV2SingleSelectField {
                      name
                    }
                  }
                }
                ... on ProjectV2ItemFieldNumberValue {
                  number
                  field {
                    ... on ProjectV2Field {
                      name
                    }
                  }
                }
                ... on ProjectV2ItemFieldTextValue {
                  text
                  field {
                    ... on ProjectV2Field {
                      name
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`

export const MUTATION_ADD_PROJECT_ITEM = `
  mutation AddProjectV2ItemById($projectId: ID!, $contentId: ID!) {
    addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
      item {
        id
      }
    }
  }
`

export const QUERY_PROJECT_STATUS_FIELD = `
  query ProjectStatusField($projectId: ID!, $fieldName: String!) {
    node(id: $projectId) {
      ... on ProjectV2 {
        id
        field(name: $fieldName) {
          ... on ProjectV2SingleSelectField {
            id
            name
            options {
              id
              name
            }
          }
        }
      }
    }
  }
`

export const MUTATION_UPDATE_SINGLE_SELECT = `
  mutation UpdateProjectV2ItemField(
    $projectId: ID!
    $itemId: ID!
    $fieldId: ID!
    $optionId: String!
  ) {
    updateProjectV2ItemFieldValue(
      input: {
        projectId: $projectId
        itemId: $itemId
        fieldId: $fieldId
        value: { singleSelectOptionId: $optionId }
      }
    ) {
      projectV2Item {
        id
      }
    }
  }
`
