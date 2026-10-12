import { audienceCohortLaunchError, csvListError, recipientListMessage } from './audienceList'

describe('audienceList', () => {
    it.each([
        { case: 'an empty file', text: '\n', expected: 'The file is empty.' },
        {
            case: 'columns without an id',
            text: 'name,company\nAda,Acme\n',
            expected: 'The file needs a column named email, distinct_id or person_id.',
        },
        { case: 'a header with no rows', text: 'email\n', expected: 'The file has a header row but no people in it.' },
        { case: 'an email column among others', text: 'Name,Email\nAda,ada@example.com\n', expected: null },
        { case: 'a person-id column among others', text: 'person-id,name\nabc,Ada\n', expected: null },
        {
            case: 'an id name only inside a quoted header',
            text: '"name,email",company\nAda,Acme\n',
            expected: 'The file needs a column named email, distinct_id or person_id.',
        },
        { case: 'one column of ids without a header', text: 'user-1\nuser-2\n', expected: null },
    ])('checks $case before uploading', ({ text, expected }) => {
        expect(csvListError(text)).toEqual(expected)
    })

    it.each([
        {
            cohort: 'an uploaded list still matching',
            state: { isStatic: true, isCalculating: true, failed: false },
            expected: '"List" is still matching people. You can launch when it finishes.',
        },
        {
            cohort: 'an uploaded list that failed to match',
            state: { isStatic: true, isCalculating: false, failed: true },
            expected: '"List" couldn\'t match its people. Remove it from the recipients, or upload the list again.',
        },
        { cohort: 'a matched list', state: { isStatic: true, isCalculating: false, failed: false }, expected: null },
        {
            cohort: 'a dynamic cohort recalculating',
            state: { isStatic: false, isCalculating: true, failed: false },
            expected: null,
        },
    ])('decides whether $cohort blocks launch', ({ state, expected }) => {
        const cohort = { id: 42, name: 'List', count: null, importTotal: null, importUnmatched: null, ...state }
        expect(audienceCohortLaunchError(cohort)).toEqual(expected)
    })

    it.each([
        {
            case: 'nothing skipped',
            dropped: [0, 0, 0],
            columns: ['email'],
            expected:
                'Added "List" to the audience. Created 2 people who weren\'t in PostHog yet. Matching the people can take a minute.',
        },
        {
            case: 'skipped rows',
            dropped: [1, 2, 0],
            columns: ['email', 'plan', 'Address, line 1'],
            expected:
                'Added "List" to the audience. Created 2 people who weren\'t in PostHog yet. Skipped 3 rows: 1 had no valid email, 2 repeated an email or distinct ID. The email can use {{ variables.plan }}, {{ variables["Address, line 1"] }}. Matching the people can take a minute.',
        },
    ])('reports an upload with $case', ({ dropped: [invalid, duplicate, tooLarge], columns, expected }) => {
        const summary = {
            id: 'list-1',
            cohort_id: 42,
            row_count: 2,
            new_people: 2,
            columns,
            dropped_invalid_email: invalid,
            dropped_duplicate_email: duplicate,
            dropped_too_large: tooLarge,
        }
        expect(recipientListMessage('List', summary)).toEqual(expected)
    })
})
