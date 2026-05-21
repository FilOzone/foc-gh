/** GraphQL documents for [contracts/github-graphql.md](../../specs/001-cross-org-board-ui/contracts/github-graphql.md) */

/**
 * Inline fragments for `fieldValues.nodes` on ProjectV2Item / project item nodes.
 * Covers all `ProjectV2ItemField*` value types from GitHub’s schema (iteration, people, reviewers, etc.).
 */
export const PROJECT_V2_ITEM_FIELD_VALUE_NODE_FRAGMENTS = `
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
            ... on ProjectV2ItemFieldDateValue {
              date
              field {
                ... on ProjectV2Field {
                  name
                }
              }
            }
            ... on ProjectV2ItemFieldIterationValue {
              title
              iterationId
              startDate
              duration
              field {
                ... on ProjectV2Field {
                  name
                }
                ... on ProjectV2IterationField {
                  name
                }
                ... on ProjectV2SingleSelectField {
                  name
                }
              }
            }
            ... on ProjectV2ItemFieldMilestoneValue {
              field {
                ... on ProjectV2Field {
                  name
                }
                ... on ProjectV2IterationField {
                  name
                }
                ... on ProjectV2SingleSelectField {
                  name
                }
              }
              milestone {
                title
                url
                number
              }
            }
            ... on ProjectV2ItemFieldLabelValue {
              field {
                ... on ProjectV2Field {
                  name
                }
                ... on ProjectV2IterationField {
                  name
                }
                ... on ProjectV2SingleSelectField {
                  name
                }
              }
              labels(first: 20) {
                nodes {
                  name
                }
              }
            }
            ... on ProjectV2ItemFieldRepositoryValue {
              field {
                ... on ProjectV2Field {
                  name
                }
                ... on ProjectV2IterationField {
                  name
                }
                ... on ProjectV2SingleSelectField {
                  name
                }
              }
              repository {
                nameWithOwner
                url
              }
            }
            ... on ProjectV2ItemFieldPullRequestValue {
              field {
                ... on ProjectV2Field {
                  name
                }
                ... on ProjectV2IterationField {
                  name
                }
                ... on ProjectV2SingleSelectField {
                  name
                }
              }
              pullRequests(first: 10) {
                nodes {
                  title
                  url
                  number
                }
              }
            }
            ... on ProjectV2ItemFieldUserValue {
              field {
                ... on ProjectV2Field {
                  name
                }
                ... on ProjectV2IterationField {
                  name
                }
                ... on ProjectV2SingleSelectField {
                  name
                }
              }
              users(first: 10) {
                nodes {
                  login
                }
              }
            }
            ... on ProjectV2ItemFieldReviewerValue {
              field {
                ... on ProjectV2Field {
                  name
                }
                ... on ProjectV2IterationField {
                  name
                }
                ... on ProjectV2SingleSelectField {
                  name
                }
              }
              reviewers(first: 10) {
                nodes {
                  ... on User {
                    login
                  }
                  ... on Bot {
                    login
                  }
                  ... on Team {
                    name
                    organization {
                      login
                    }
                  }
                  ... on Mannequin {
                    login
                  }
                }
              }
            }
`

export const QUERY_VIEWER = `
  query Viewer {
    viewer {
      login
    }
  }
`

export const QUERY_REPO_ACCESS = `
  query RepoAccess($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      id
      nameWithOwner
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

/**
 * Discover board column definitions (names, data types, single-select options, iteration catalog).
 *
 * Uses `ProjectV2FieldCommon` for shared id/name/dataType fields per GitHub
 * Support recommendation. `dataType` is used to distinguish TEXT, NUMBER,
 * DATE, etc. among generic ProjectV2Field nodes.
 *
 * History: `dataType` previously crashed on built-in timestamp fields
 * (Created, Updated, Closed) — fixed by GitHub 2026-05-20.
 * GitHub support ticket: https://support.github.com/ticket/personal/0/4386180
 */
export const QUERY_PROJECT_V2_FIELD_DEFINITIONS = `
  query ProjectV2FieldDefinitions($projectId: ID!) {
    node(id: $projectId) {
      ... on ProjectV2 {
        id
        title
        fields(first: 100) {
          totalCount
          nodes {
            __typename
            ... on ProjectV2FieldCommon {
              id
              name
              dataType
            }
            ... on ProjectV2SingleSelectField {
              options {
                id
                name
                color
                description
              }
            }
            ... on ProjectV2IterationField {
              configuration {
                duration
                startDay
                iterations {
                  id
                  title
                  startDate
                  duration
                }
                completedIterations {
                  id
                  title
                  startDate
                  duration
                }
              }
            }
          }
        }
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
            fieldValues(first: 50) {
              nodes {
${PROJECT_V2_ITEM_FIELD_VALUE_NODE_FRAGMENTS}
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
            fieldValues(first: 50) {
              nodes {
${PROJECT_V2_ITEM_FIELD_VALUE_NODE_FRAGMENTS}
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
            fieldValues(first: 50) {
              nodes {
${PROJECT_V2_ITEM_FIELD_VALUE_NODE_FRAGMENTS}
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

/** Remove a draft / issue / PR card from a Projects v2 board. */
export const MUTATION_DELETE_PROJECT_ITEM = `
  mutation DeleteProjectV2Item($projectId: ID!, $itemId: ID!) {
    deleteProjectV2Item(input: { projectId: $projectId, itemId: $itemId }) {
      deletedItemId
    }
  }
`

/** Load field values for a ProjectV2Item node id (after resolving item via REST or scan). */
export const QUERY_PROJECT_V2_ITEM_FIELD_VALUES = `
  query ProjectV2ItemFieldValues($itemId: ID!) {
    node(id: $itemId) {
      ... on ProjectV2Item {
        id
        fieldValues(first: 50) {
          nodes {
${PROJECT_V2_ITEM_FIELD_VALUE_NODE_FRAGMENTS}
          }
        }
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

export const MUTATION_UPDATE_NUMBER = `
  mutation UpdateProjectV2Number($projectId: ID!, $itemId: ID!, $fieldId: ID!, $number: Float!) {
    updateProjectV2ItemFieldValue(
      input: {
        projectId: $projectId
        itemId: $itemId
        fieldId: $fieldId
        value: { number: $number }
      }
    ) {
      projectV2Item {
        id
      }
    }
  }
`

export const MUTATION_UPDATE_TEXT = `
  mutation UpdateProjectV2Text($projectId: ID!, $itemId: ID!, $fieldId: ID!, $text: String!) {
    updateProjectV2ItemFieldValue(
      input: {
        projectId: $projectId
        itemId: $itemId
        fieldId: $fieldId
        value: { text: $text }
      }
    ) {
      projectV2Item {
        id
      }
    }
  }
`

export const MUTATION_CLEAR_FIELD = `
  mutation ClearProjectV2ItemField($projectId: ID!, $itemId: ID!, $fieldId: ID!) {
    clearProjectV2ItemFieldValue(
      input: {
        projectId: $projectId
        itemId: $itemId
        fieldId: $fieldId
      }
    ) {
      projectV2Item {
        id
      }
    }
  }
`

export const MUTATION_UPDATE_ITERATION = `
  mutation UpdateProjectV2Iteration(
    $projectId: ID!
    $itemId: ID!
    $fieldId: ID!
    $iterationId: String!
  ) {
    updateProjectV2ItemFieldValue(
      input: {
        projectId: $projectId
        itemId: $itemId
        fieldId: $fieldId
        value: { iterationId: $iterationId }
      }
    ) {
      projectV2Item {
        id
      }
    }
  }
`
