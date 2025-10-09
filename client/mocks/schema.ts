// client/mocks/schema.ts
// This file should now be manually maintained, NOT auto-generated.

// ACCOUNTS MOCK DATA
export const accounts = [
  {
    id: 44,
    userId: 5,
    type: "type_1",
    provider: "provider_1",
    providerAccountId: "providerAccountId_1",
    refreshToken: "refreshToken_1",
    expiresAt: 5,
    idToken: "idToken_1",
    scope: "scope_1",
    sessionState: "sessionState_1",
    tokenType: "tokenType_1",
  },
];

// SESSIONS MOCK DATA
export const sessions = [
  {
    id: 90,
    userId: 48,
    expires: "2025-08-11T14:49:01.164Z",
    sessionToken: "sessionToken_1",
  },
];

// DOCUMENTS MOCK DATA
export const documents = [
  {
    id: "vk2vc813-2wlz-y1mz-y9a8-tjl81lfuvjp",
    createdAt: "2025-08-11T14:49:01.164Z",
    updatedAt: "2025-08-11T14:49:01.164Z",
    name: "Documents 1",
    filePath: "filePath_1",
    mimeType: "mimeType_1",
    type: "homework",
    classified: false,
    fileId: "fileId_1",
    active: true,
    tags: ["tags_1"],
  },
];

// USERS MOCK DATA
export const users = [
  {
    id: 74,
    name: "Admin User",
    email: "admin@example.com",
    emailVerified: "2025-08-11T14:49:01.164Z",
    image: "image_1",
  },
  {
    id: 66,
    name: "Instructional User",
    email: "instructional@example.com",
    emailVerified: "2025-08-11T14:49:01.164Z",
    image: "image_2",
  },
  {
    id: 71,
    email: "instructor@example.com",
    emailVerified: "2025-08-11T14:49:01.164Z",
  },
  {
    id: 85,
    name: "TA User",
    email: "ta@example.com",
    emailVerified: "2025-08-11T14:49:01.164Z",
    image: "image_4",
  },
];

// PROFILES MOCK DATA
export const profiles = [
  {
    id: "iyg5khfu-mdg6-qvmu-pm2z-n0t5mmbnkpa",
    updatedAt: "2025-08-11T14:49:01.164Z",
    userId: 74,
    lastLogin: "2025-08-11T14:49:01.164Z",
    firstName: "Admin",
    lastName: "User",
    alias: "admin-user",
    viewedIntro: "viewedIntro_1",
    viewedChat: "viewedChat_1",
    createdAt: "2025-08-11T14:49:01.164Z",
    role: "admin",
    defaultProfile: "defaultProfile_1",
    active: true,
    lastActive: "2025-08-11T14:49:01.164Z",
  },
  {
    id: "dmp19a8r-k4le-ng1s-5v5u-1h9sdfvsziv",
    updatedAt: "2025-08-11T14:49:01.164Z",
    userId: 66,
    lastLogin: "2025-08-11T14:49:01.164Z",
    firstName: "Instructional",
    lastName: "User",
    alias: "instructional-user",
    viewedIntro: "viewedIntro_2",
    viewedChat: "viewedChat_2",
    createdAt: "2025-08-11T14:49:01.164Z",
    role: "instructional",
    defaultProfile: "defaultProfile_2",
    active: false,
    lastActive: "2025-08-11T14:49:01.164Z",
  },
  {
    id: "xb6c9ios-4oft-3p80-k9r0-72fl97q0kv9",
    updatedAt: "2025-08-11T14:49:01.164Z",
    userId: 71,
    lastLogin: "2025-08-11T14:49:01.164Z",
    firstName: "Instructor",
    lastName: "User",
    alias: "instructor-user",
    viewedIntro: "viewedIntro_3",
    viewedChat: "viewedChat_3",
    createdAt: "2025-08-11T14:49:01.164Z",
    role: "instructor",
    defaultProfile: "defaultProfile_3",
    active: false,
    lastActive: "2025-08-11T14:49:01.164Z",
  },
  {
    id: "jvz8xfaz-8o9v-rx6a-yb3o-rcb4dvg81u",
    updatedAt: "2025-08-11T14:49:01.164Z",
    userId: 85,
    lastLogin: "2025-08-11T14:49:01.164Z",
    firstName: "TA",
    lastName: "User",
    alias: "ta-user",
    viewedIntro: "viewedIntro_4",
    viewedChat: "viewedChat_4",
    createdAt: "2025-08-11T14:49:01.164Z",
    role: "ta",
    defaultProfile: "defaultProfile_4",
    active: false,
    lastActive: "2025-08-11T14:49:01.164Z",
  },
];

// PROVIDERS MOCK DATA
export const providers = [
  {
    id: "bkrd7vwp-xptx-9wyu-l3uw-aq4548sr7mq",
    createdAt: "2025-08-11T14:49:01.164Z",
    updatedAt: "2025-08-11T14:49:01.164Z",
    name: "Providers 1",
    description: "Description for providers 1",
    apiKey: "apiKey_1",
    baseUrl: "baseUrl_1",
  },
];

// MODELS MOCK DATA
export const models = [
  {
    id: "et7ahcbp-za1v-rcb4-pypg-e2ekumdb4a8",
    createdAt: "2025-08-11T14:49:01.164Z",
    updatedAt: "2025-08-11T14:49:01.164Z",
    name: "Models 1",
    description: "Description for models 1",
    providerId: "providerId_1",
    active: true,
    inputPpm: "inputPpm_1",
    outputPpm: "outputPpm_1",
  },
];

// RUBRICS MOCK DATA
export const rubrics = [
  {
    id: "mb5uuv20-d8d9-zslk-8sot-2cfhkrwhmxg",
    createdAt: "2025-08-11T14:49:01.164Z",
    updatedAt: "2025-08-11T14:49:01.164Z",
    name: "Math Problem Solving Rubric",
    description: "Evaluates mathematical reasoning and problem-solving skills",
    points: 89,
    passPoints: "passPoints_1",
    defaultRubric: "defaultRubric_1",
    active: true,
  },
  {
    id: "iexo4aoc-ssuh-x3mz-irrx-b9fuhpiff9g",
    createdAt: "2025-08-11T14:49:01.164Z",
    updatedAt: "2025-08-11T14:49:01.164Z",
    name: "Science Lab Rubric",
    description: "Assesses lab technique and safety knowledge",
    points: 82,
    passPoints: "passPoints_2",
    defaultRubric: "defaultRubric_2",
    active: false,
  },
];

// STANDARDGROUPS MOCK DATA
export const standardGroups = [
  {
    id: "5v91ivqk-jyl9-slrg-zf6p-6sanalve1dk",
    createdAt: "2025-08-11T14:49:01.164Z",
    name: "Standard_groups 1",
    shortName: "shortName_1",
    description: "Description for standard_groups 1",
    points: 79,
    passPoints: "passPoints_1",
    rubricId: "rubricId_1",
  },
];

// APPLOGS MOCK DATA
export const appLogs = [
  {
    id: 75,
    level: "level_1",
    message: "message_1",
    context: {},
    createdAt: "2025-08-11T14:49:01.164Z",
  },
];

// STANDARDS MOCK DATA
export const standards = [
  {
    id: "lhxduz2u-92qc-6iv4-8naz-c92fko2woh7",
    createdAt: "2025-08-11T14:49:01.164Z",
    name: "Standards 1",
    description: "Description for standards 1",
    points: 63,
    standardGroupId: "standardGroupId_1",
  },
];

// APPFEEDBACK MOCK DATA
export const appFeedback = [
  {
    id: 82,
    createdAt: "2025-08-11T14:49:01.164Z",
    profileId: "profileId_1",
    type: "feature",
    message: "message_1",
  },
];

// ASSISTANTCHATS MOCK DATA
export const assistantChats = [
  {
    id: "220zbgnn-d0ga-f20o-bxtb-f9ulsol5dnl",
    createdAt: "2025-08-11T14:49:01.164Z",
    updatedAt: "2025-08-11T14:49:01.164Z",
    title: "Assistant_chats 1",
    profileId: "profileId_1",
    traceId: "traceId_1",
  },
];

// ASSISTANTMESSAGES MOCK DATA
export const assistantMessages = [
  {
    id: "0uz6rxsv-taoa-7o2l-c9qa-2icqrdna7pv",
    createdAt: "2025-08-11T14:49:01.164Z",
    updatedAt: "2025-08-11T14:49:01.164Z",
    completedAt: "2025-08-11T14:49:01.164Z",
    chatId: "chatId_1",
    role: "user",
    content: "content_1",
    completed: true,
  },
];

// ASSISTANTTOOLCALLS MOCK DATA
export const assistantToolCalls = [
  {
    id: "edlq51nc-0gpm-seuk-ps69-upfirqotzjj",
    createdAt: "2025-08-11T14:49:01.164Z",
    updatedAt: "2025-08-11T14:49:01.164Z",
    chatId: "chatId_1",
    toolName: "toolName_1",
    toolType: "toolType_1",
    toolArguments: "toolArguments_1",
    toolResult: "toolResult_1",
    completed: true,
  },
];

// PERSONAS MOCK DATA
export const personas = [
  {
    id: "79ud8ai3-kno7-1blu-po3m-6ych5lwsu0l",
    createdAt: "2025-08-11T14:49:01.164Z",
    updatedAt: "2025-08-11T14:49:01.164Z",
    name: "Personas 1",
    description: "Description for personas 1",
    systemPrompt: "systemPrompt_1",
    temperature: "temperature_1",
    defaultPersona: "defaultPersona_1",
    color: "color_1",
    icon: "icon_1",
    reasoning: "minimal",
    active: true,
    guardrailActive: "guardrailActive_1",
  },
];

// AGENTS MOCK DATA
export const agents = [
  {
    id: "y16qseim-5ylq-v8mo-795k-xk9bqypwvg",
    createdAt: "2025-08-11T14:49:01.164Z",
    updatedAt: "2025-08-11T14:49:01.164Z",
    name: "Math Tutor Agent",
    description:
      "Helps students with mathematical concepts and problem-solving",
    systemPrompt:
      "You are a helpful math tutor. Guide students through problems step by step.",
    temperature: "temperature_1",
    modelId: "modelId_1",
  },
  {
    id: "woz28q2v-bvmj-vyoi-gnk9-azho9s0vdp9",
    createdAt: "2025-08-11T14:49:01.164Z",
    updatedAt: "2025-08-11T14:49:01.164Z",
    name: "Science Helper Bot",
    description: "Assists with scientific inquiries and experiments",
    systemPrompt:
      "You are a science assistant. Help students understand scientific concepts.",
    temperature: "temperature_2",
    modelId: "modelId_2",
  },
];

// MODELRUNS MOCK DATA
export const modelRuns = [
  {
    id: "xz7p4wz2-kdbs-6zl6-uxsg-h0dm1p22ne8",
    createdAt: "2025-08-11T14:49:01.164Z",
    updatedAt: "2025-08-11T14:49:01.164Z",
    modelId: "modelId_1",
    inputTokens: "inputTokens_1",
    outputTokens: "outputTokens_1",
    personaId: "personaId_1",
    agentId: "agentId_1",
    profileId: "profileId_1",
  },
];

// DEBUGINFO MOCK DATA
export const debugInfo = [
  {
    id: "3b41cknn-l5sq-x2na-mruv-tdv186tq7q",
    createdAt: "2025-08-11T14:49:01.164Z",
    modelRunId: "modelRunId_1",
    content: "content_1",
  },
];

// SCENARIOS MOCK DATA
export const scenarios = [
  {
    id: "qb76i840-mz5t-u4ni-i7hm-ltwc4nf2bs",
    createdAt: "2025-08-11T14:49:01.164Z",
    updatedAt: "2025-08-11T14:49:01.164Z",
    name: "Algebra Problem Solving",
    description:
      "Students work through complex algebra problems with AI assistance",
    personaId: "personaId_1",
    defaultScenario: "defaultScenario_1",
    practiceScenario: "practiceScenario_1",
    generated: false,
    active: true,
  },
  {
    id: "bzdi5lpy-fkqw-mc58-rp2j-lq4wtkf9qg",
    createdAt: "2025-08-11T14:49:01.164Z",
    updatedAt: "2025-08-11T14:49:01.164Z",
    name: "Chemistry Lab Safety",
    description:
      "Students learn lab safety protocols through interactive scenarios",
    personaId: "personaId_2",
    parameterItemIds: ["parameterItemIds_2"],
    documentIds: ["documentIds_2"],
    defaultScenario: "defaultScenario_2",
    practiceScenario: "practiceScenario_2",
    generated: false,
    parentId: "parentId_2",
    active: false,
  },
];

// PARAMETERS MOCK DATA
export const parameters = [
  {
    id: "ffefwcpw-j3vl-y183-wxbi-kolf3ra61ij",
    createdAt: "2025-08-11T14:49:01.164Z",
    updatedAt: "2025-08-11T14:49:01.164Z",
    name: "Parameters 1",
    description: "Description for parameters 1",
    numerical: false,
    active: true,
    defaultParameter: "defaultParameter_1",
  },
];

// PARAMETERITEMS MOCK DATA
export const parameterItems = [
  {
    id: "fjshtx4n-cszj-pg0p-rbot-1oipns2n06u",
    createdAt: "2025-08-11T14:49:01.164Z",
    updatedAt: "2025-08-11T14:49:01.164Z",
    name: "Parameter_items 1",
    description: "Description for parameter_items 1",
    value: "value_1",
    parameterId: "parameterId_1",
    defaultItem: "defaultItem_1",
  },
];

// SIMULATIONATTEMPTS MOCK DATA
export const simulationAttempts = [
  {
    id: "lx8okf5a-6lok-nv6m-677x-8qjxxsvx0bh",
    createdAt: "2025-08-11T14:49:01.164Z",
    simulationId: "simulationId_1",
    infiniteMode: "infiniteMode_1",
  },
];

// SIMULATIONS MOCK DATA
export const simulations = [
  {
    id: "4lnoxozx-yyle-pw15-i6f4-s036clmht9f",
    createdAt: "2025-08-11T14:49:01.164Z",
    updatedAt: "2025-08-11T14:49:01.164Z",
    title: "Math Practice Simulation",
    timeLimit: "timeLimit_1",
    active: true,
    scenarioIds: [
      "qb76i840-mz5t-u4ni-i7hm-ltwc4nf2bs",
      "bzdi5lpy-fkqw-mc58-rp2j-lq4wtkf9qg",
    ],
    rubricId: "rubricId_1",
    defaultSimulation: "defaultSimulation_1",
    practiceSimulation: "practiceSimulation_1",
  },
  {
    id: "ipd7ny5b-vxc9-z4e3-gn3u-alliqv3ew3c",
    createdAt: "2025-08-11T14:49:01.164Z",
    updatedAt: "2025-08-11T14:49:01.164Z",
    title: "Lab Safety Training",
    timeLimit: "timeLimit_2",
    active: false,
    scenarioIds: [
      "qb76i840-mz5t-u4ni-i7hm-ltwc4nf2bs",
      "bzdi5lpy-fkqw-mc58-rp2j-lq4wtkf9qg",
    ],
    rubricId: "rubricId_2",
    defaultSimulation: "defaultSimulation_2",
    practiceSimulation: "practiceSimulation_2",
  },
];

// SIMULATIONCHATS MOCK DATA
export const simulationChats = [
  {
    id: "5y8ltoy6-wc6o-ogxl-id1x-rsawjwxbqm",
    createdAt: "2025-08-11T14:49:01.164Z",
    updatedAt: "2025-08-11T14:49:01.164Z",
    completedAt: "2025-08-11T14:49:01.164Z",
    title: "Simulation_chats 1",
    scenarioId: "scenarioId_1",
    attemptId: "attemptId_1",
    completed: false,
    traceId: "traceId_1",
  },
];

// SIMULATIONMESSAGES MOCK DATA
export const simulationMessages = [
  {
    id: "mly0wtjy-0j7c-u82y-9apt-2ophgt3lm75",
    createdAt: "2025-08-11T14:49:01.164Z",
    updatedAt: "2025-08-11T14:49:01.164Z",
    chatId: "chatId_1",
    content: "content_1",
    type: "query",
    completed: true,
  },
];

// SIMULATIONCHATGRADES MOCK DATA
export const simulationChatGrades = [
  {
    id: "xh0rmusf-cpev-k2tu-uguo-u3v1eumgt7",
    createdAt: "2025-08-11T14:49:01.164Z",
    passed: true,
    score: 79,
    timeTaken: "timeTaken_1",
    rubricId: "rubricId_1",
    simulationChatId: "simulationChatId_1",
  },
];

// SIMULATIONCHATFEEDBACKS MOCK DATA
export const simulationChatFeedbacks = [
  {
    id: "0v0cjixa-igb4-m47z-1lpo-kdq1ichb57",
    createdAt: "2025-08-11T14:49:01.164Z",
    standardId: "standardId_1",
    simulationChatGradeId: "simulationChatGradeId_1",
    total: 40,
  },
];

// SIMULATIONCHATCROWDSOURCEDFEEDBACKS MOCK DATA
export const simulationChatCrowdsourcedFeedbacks = [
  {
    id: "z5bl6qvj-583o-ht6u-03u3-3np56osdzw",
    createdAt: "2025-08-11T14:49:01.164Z",
    profileId: "profileId_1",
    simulationChatFeedbackId: "simulationChatFeedbackId_1",
    total: 71,
    feedback: "feedback_1",
  },
];

// SIMULATIONCROWDSOURCEDMESSAGES MOCK DATA
export const simulationCrowdsourcedMessages = [
  {
    id: "0r9dkxuy-t2ar-04p8-w6d3-zt6dnbf650r",
    createdAt: "2025-08-11T14:49:01.164Z",
    simulationMessageId: "simulationMessageId_1",
    profileId: "profileId_1",
    response: true,
  },
];

// COHORTS MOCK DATA
export const cohorts = [
  {
    id: "k2st3hqz-v50x-gja8-kjq8-26oibjhnrd6",
    createdAt: "2025-08-11T14:49:01.164Z",
    updatedAt: "2025-08-11T14:49:01.164Z",
    title: "Fall 2024 Cohort",
    description: "Students enrolled in fall semester courses",
    active: true,
    profileIds: [
      "iyg5khfu-mdg6-qvmu-pm2z-n0t5mmbnkpa",
      "dmp19a8r-k4le-ng1s-5v5u-1h9sdfvsziv",
      "xb6c9ios-4oft-3p80-k9r0-72fl97q0kv9",
      "jvz8xfaz-8o9v-rx6a-yb3o-rcb4dvg81u",
    ],
    defaultCohort: "defaultCohort_1",
    simulationIds: [
      "4lnoxozx-yyle-pw15-i6f4-s036clmht9f",
      "ipd7ny5b-vxc9-z4e3-gn3u-alliqv3ew3c",
    ],
  },
  {
    id: "oyzpfbo2-zc17-9tf6-voab-d5xwywgsc7v",
    createdAt: "2025-08-11T14:49:01.164Z",
    updatedAt: "2025-08-11T14:49:01.164Z",
    title: "Spring 2024 Advanced",
    description: "Advanced students in spring programs",
    active: false,
    profileIds: [
      "iyg5khfu-mdg6-qvmu-pm2z-n0t5mmbnkpa",
      "dmp19a8r-k4le-ng1s-5v5u-1h9sdfvsziv",
      "xb6c9ios-4oft-3p80-k9r0-72fl97q0kv9",
      "jvz8xfaz-8o9v-rx6a-yb3o-rcb4dvg81u",
    ],
    defaultCohort: "defaultCohort_2",
    simulationIds: [
      "4lnoxozx-yyle-pw15-i6f4-s036clmht9f",
      "ipd7ny5b-vxc9-z4e3-gn3u-alliqv3ew3c",
    ],
  },
];

// VERIFICATIONTOKEN MOCK DATA
export const verificationToken = [
  {
    identifier: "identifier_1",
    expires: "2025-08-11T14:49:01.164Z",
    token: "token_1",
  },
];

export const departments = [
  {
    id: "b7e8f2c1-3a4d-4e2b-9c6f-2a1e5d7f8c9b",
    createdAt: "2025-08-11T14:49:01.164Z",
    updatedAt: "2025-08-11T14:49:01.164Z",
    title: "Department 1",
    description: "Description for department 1",
  },
];

// SIMULATIONHINTS MOCK DATA
export const simulationHints = [
  {
    id: "12345678-1234-1234-1234-123456789012",
    createdAt: "2025-08-11T14:49:01.164Z",
    updatedAt: "2025-08-11T14:49:01.164Z",
    hint: "hint_1",
    simulationMessageId: "simulationMessageId_1",
  },
  {
    id: "12345678-1234-1234-1234-123456789012",
    createdAt: "2025-08-11T14:49:01.164Z",
    updatedAt: "2025-08-11T14:49:01.164Z",
    hint: "hint_2",
    simulationMessageId: "simulationMessageId_2",
  },
];
