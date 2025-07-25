// Mock schema for the database, so we have mock data to work with
// Generated automatically by generate-mocks.js

// ACCOUNTS MOCK DATA
export const accounts = [
  {
    "id": 3,
    "userId": 96,
    "type": "type_1",
    "provider": "provider_1",
    "providerAccountId": "providerAccountId_1",
    "refreshToken": "refreshToken_1",
    "accessToken": "accessToken_1",
    "mode": "mode_1",
    "scope": "scope_1",
    "sessionState": "sessionState_1"
  }
];

// SESSIONS MOCK DATA
export const sessions = [
  {
    "id": 42,
    "userId": 96,
    "expires": "2025-07-25T02:37:04.077Z",
    "sessionToken": "sessionToken_1"
  }
];

// DOCUMENTS MOCK DATA
export const documents = [
  {
    "id": "ebantidi-g3ak-infl-xq34-jyp046qk5e8",
    "createdAt": "2025-07-25T02:37:04.077Z",
    "updatedAt": "2025-07-25T02:37:04.077Z",
    "name": "Documents 1",
    "filePath": "filePath_1",
    "mimeType": "mimeType_1",
    "type": "homework",
    "classified": false,
    "fileId": "fileId_1",
    "active": true
  }
];

// USERS MOCK DATA
export const users = [
  {
    "id": 79,
    "name": "Admin User",
    "email": "admin@example.com",
    "emailVerified": "2025-07-25T02:37:04.077Z",
    "image": "image_1"
  },
  {
    "id": 32,
    "name": "Instructional User",
    "email": "instructional@example.com",
    "emailVerified": "2025-07-25T02:37:04.077Z",
    "image": "image_2"
  },
  {
    "id": 36,
    "name": "Instructor User",
    "email": "instructor@example.com",
    "emailVerified": "2025-07-25T02:37:04.077Z",
    "image": "image_3"
  },
  {
    "id": 12,
    "name": "TA User",
    "email": "ta@example.com",
    "image": "image_4"
  }
];

// PROFILES MOCK DATA
export const profiles = [
  {
    "id": "auusw0yu-fiaj-7ckx-8zf9-wn2nm75crn",
    "updatedAt": "2025-07-25T02:37:04.077Z",
    "userId": 79,
    "lastLogin": "2025-07-25T02:37:04.077Z",
    "firstName": "Admin",
    "lastName": "User",
    "alias": "admin-user",
    "viewedIntro": "viewedIntro_1",
    "viewedChat": "viewedChat_1",
    "createdAt": "2025-07-25T02:37:04.077Z",
    "role": "admin",
    "defaultProfile": "defaultProfile_1",
    "active": true,
    "lastActive": "2025-07-25T02:37:04.077Z"
  },
  {
    "id": "0hwap0ix-2vcy-izn6-mtbh-b0903dqcl8b",
    "updatedAt": "2025-07-25T02:37:04.077Z",
    "lastLogin": "2025-07-25T02:37:04.077Z",
    "firstName": "Instructional",
    "lastName": "User",
    "alias": "instructional-user",
    "viewedIntro": "viewedIntro_2",
    "viewedChat": "viewedChat_2",
    "createdAt": "2025-07-25T02:37:04.077Z",
    "role": "instructional",
    "defaultProfile": "defaultProfile_2",
    "active": false,
    "lastActive": "2025-07-25T02:37:04.077Z",
    "userId": 32
  },
  {
    "id": "9isc8w2j-0nem-qyul-t73r-wbcwtxe0ih",
    "updatedAt": "2025-07-25T02:37:04.077Z",
    "lastLogin": "2025-07-25T02:37:04.077Z",
    "firstName": "Instructor",
    "lastName": "User",
    "alias": "instructor-user",
    "viewedIntro": "viewedIntro_3",
    "viewedChat": "viewedChat_3",
    "createdAt": "2025-07-25T02:37:04.077Z",
    "role": "instructor",
    "defaultProfile": "defaultProfile_3",
    "active": false,
    "lastActive": "2025-07-25T02:37:04.077Z",
    "userId": 36
  },
  {
    "id": "ume43jas-klm4-wq2u-b47u-c30zhbmhreh",
    "updatedAt": "2025-07-25T02:37:04.077Z",
    "lastLogin": "2025-07-25T02:37:04.077Z",
    "firstName": "TA",
    "lastName": "User",
    "alias": "ta-user",
    "viewedIntro": "viewedIntro_4",
    "viewedChat": "viewedChat_4",
    "createdAt": "2025-07-25T02:37:04.077Z",
    "role": "ta",
    "defaultProfile": "defaultProfile_4",
    "active": false,
    "lastActive": "2025-07-25T02:37:04.077Z",
    "userId": 12
  }
];

// PROVIDERS MOCK DATA
export const providers = [
  {
    "id": "zxdk2524-f3g6-n9nl-ixl2-xntox2daxsd",
    "createdAt": "2025-07-25T02:37:04.077Z",
    "updatedAt": "2025-07-25T02:37:04.077Z",
    "name": "Providers 1",
    "description": "Description for providers 1",
    "apiKey": "apiKey_1"
  }
];

// MODELS MOCK DATA
export const models = [
  {
    "id": "shk77nl2-exi6-vvsx-pr1s-7ydt3lzx83m",
    "createdAt": "2025-07-25T02:37:04.077Z",
    "updatedAt": "2025-07-25T02:37:04.077Z",
    "name": "Models 1",
    "description": "Description for models 1",
    "providerId": "providerId_1",
    "active": true
  }
];

// RUBRICS MOCK DATA
export const rubrics = [
  {
    "id": "m55yurnz-1bgg-qej2-xv6s-5z7nux85u9u",
    "createdAt": "2025-07-25T02:37:04.077Z",
    "updatedAt": "2025-07-25T02:37:04.077Z",
    "name": "Math Problem Solving Rubric",
    "description": "Evaluates mathematical reasoning and problem-solving skills",
    "points": 72,
    "passPoints": "passPoints_1",
    "defaultRubric": "defaultRubric_1",
    "active": true
  },
  {
    "id": "qi3yvjlh-t3y6-twgh-d6pg-ns3wf8jzwkr",
    "createdAt": "2025-07-25T02:37:04.077Z",
    "updatedAt": "2025-07-25T02:37:04.077Z",
    "name": "Science Lab Rubric",
    "description": "Assesses lab technique and safety knowledge",
    "points": 44,
    "passPoints": "passPoints_2",
    "defaultRubric": "defaultRubric_2",
    "active": false
  }
];

// STANDARDGROUPS MOCK DATA
export const standardGroups = [
  {
    "id": "zhjno58t-qmvu-2ro7-srrt-zfi02a7mzre",
    "createdAt": "2025-07-25T02:37:04.077Z",
    "name": "Standard_groups 1",
    "shortName": "shortName_1",
    "description": "Description for standard_groups 1",
    "points": 87,
    "passPoints": "passPoints_1",
    "rubricId": "rubricId_1"
  }
];

// APPLOGS MOCK DATA
export const appLogs = [
  {
    "id": 92,
    "level": "level_1",
    "message": "message_1",
    "context": {},
    "createdAt": "2025-07-25T02:37:04.077Z"
  }
];

// STANDARDS MOCK DATA
export const standards = [
  {
    "id": "reogv378-855u-0hdg-m21l-lh9zbrk6uir",
    "createdAt": "2025-07-25T02:37:04.077Z",
    "name": "Standards 1",
    "description": "Description for standards 1",
    "points": 46,
    "standardGroupId": "standardGroupId_1"
  }
];

// APPFEEDBACK MOCK DATA
export const appFeedback = [
  {
    "id": 63,
    "createdAt": "2025-07-25T02:37:04.077Z",
    "type": "feature",
    "message": "message_1"
  }
];

// ASSISTANTCHATS MOCK DATA
export const assistantChats = [
  {
    "id": "w7yyahsj-c16s-b6fj-dks2-haxataeah9",
    "createdAt": "2025-07-25T02:37:04.077Z",
    "updatedAt": "2025-07-25T02:37:04.077Z",
    "title": "Assistant_chats 1",
    "profileId": "profileId_1",
    "traceId": "traceId_1"
  }
];

// ASSISTANTMESSAGES MOCK DATA
export const assistantMessages = [
  {
    "id": "ov1nsu8g-qae9-8e30-5eny-poohrk54r0t",
    "createdAt": "2025-07-25T02:37:04.077Z",
    "updatedAt": "2025-07-25T02:37:04.077Z",
    "completedAt": "2025-07-25T02:37:04.077Z",
    "chatId": "chatId_1",
    "role": "user",
    "content": "content_1",
    "completed": false
  }
];

// ASSISTANTTOOLCALLS MOCK DATA
export const assistantToolCalls = [
  {
    "id": "jb7yj0mr-fplb-8wgx-e8ha-o2wdrd4turj",
    "createdAt": "2025-07-25T02:37:04.077Z",
    "updatedAt": "2025-07-25T02:37:04.077Z",
    "completedAt": "2025-07-25T02:37:04.077Z",
    "chatId": "chatId_1",
    "toolName": "toolName_1",
    "toolType": "toolType_1",
    "toolArguments": "toolArguments_1",
    "toolResult": "toolResult_1",
    "completed": true
  }
];

// PERSONAS MOCK DATA
export const personas = [
  {
    "id": "2muco155-m786-znbg-pyhs-xkq8f5i7zz",
    "createdAt": "2025-07-25T02:37:04.077Z",
    "updatedAt": "2025-07-25T02:37:04.077Z",
    "name": "Personas 1",
    "description": "Description for personas 1",
    "systemPrompt": "systemPrompt_1",
    "temperature": 0.01,
    "defaultPersona": "defaultPersona_1",
    "color": "color_1",
    "modelId": "modelId_1",
    "reasoning": "low"
  }
];

// SYSTEMAGENTS MOCK DATA
export const systemAgents = [
  {
    "id": "7no939wu-2c7e-iunm-abqy-k6y4ng50c6h",
    "createdAt": "2025-07-25T02:37:04.077Z",
    "updatedAt": "2025-07-25T02:37:04.077Z",
    "name": "System_agents 1",
    "description": "Description for system_agents 1",
    "systemPrompt": "systemPrompt_1",
    "temperature": 0.83
  }
];

// SCENARIOS MOCK DATA
export const scenarios = [
  {
    "id": "6iun3l2s-cj8k-gti7-0fb2-bq9xa7i80ja",
    "createdAt": "2025-07-25T02:37:04.077Z",
    "updatedAt": "2025-07-25T02:37:04.077Z",
    "name": "Algebra Problem Solving",
    "description": "Students work through complex algebra problems with AI assistance",
    "personaId": "personaId_1",
    "crowdedness": 94,
    "intensity": 54,
    "locationId": "locationId_1",
    "timeId": "timeId_1",
    "documentIds": [
      "documentIds_1"
    ],
    "defaultScenario": "defaultScenario_1",
    "practiceScenario": "practiceScenario_1",
    "generated": false,
    "parentId": "parentId_1",
    "active": true
  },
  {
    "id": "ay6iz5m1-5zfh-e72t-57ao-9lybw65q3wi",
    "createdAt": "2025-07-25T02:37:04.077Z",
    "updatedAt": "2025-07-25T02:37:04.077Z",
    "name": "Chemistry Lab Safety",
    "description": "Students learn lab safety protocols through interactive scenarios",
    "personaId": "personaId_2",
    "classId": "classId_2",
    "locationId": "locationId_2",
    "deadlineId": "deadlineId_2",
    "timeId": "timeId_2",
    "documentIds": [
      "documentIds_2"
    ],
    "defaultScenario": "defaultScenario_2",
    "practiceScenario": "practiceScenario_2",
    "generated": true,
    "active": false
  }
];

// SCENARIOCLASSES MOCK DATA
export const scenarioClasses = [
  {
    "id": "c330zfz8-di7p-yqw9-vkej-tb1axjq01do",
    "createdAt": "2025-07-25T02:37:04.077Z",
    "updatedAt": "2025-07-25T02:37:04.077Z",
    "name": "Scenario_classes 1",
    "classCode": "classCode_1",
    "description": "Description for scenario_classes 1"
  }
];

// SCENARIOLOCATIONS MOCK DATA
export const scenarioLocations = [
  {
    "id": "nmccotf1-mjwf-9zox-568d-sdzgsprcf5o",
    "createdAt": "2025-07-25T02:37:04.077Z",
    "updatedAt": "2025-07-25T02:37:04.077Z",
    "name": "Scenario_locations 1",
    "description": "Description for scenario_locations 1"
  }
];

// SCENARIODEADLINES MOCK DATA
export const scenarioDeadlines = [
  {
    "id": "m0idq2am-lso3-alxz-z3bk-m8u4n2sp4c",
    "createdAt": "2025-07-25T02:37:04.077Z",
    "updatedAt": "2025-07-25T02:37:04.077Z",
    "deadline": "deadline_1",
    "description": "Description for scenario_deadlines 1"
  }
];

// SCENARIOTIMES MOCK DATA
export const scenarioTimes = [
  {
    "id": "i362eu1y-y8gd-atz0-h2ql-rv9ba47k3b",
    "createdAt": "2025-07-25T02:37:04.077Z",
    "updatedAt": "2025-07-25T02:37:04.077Z",
    "timeOfDay": "timeOfDay_1",
    "description": "Description for scenario_times 1"
  }
];

// SIMULATIONS MOCK DATA
export const simulations = [
  {
    "id": "ij5v1uxs-zvat-o54j-7edh-raw3ld0e4tn",
    "createdAt": "2025-07-25T02:37:04.077Z",
    "updatedAt": "2025-07-25T02:37:04.077Z",
    "title": "Math Practice Simulation",
    "timeLimit": "timeLimit_1",
    "active": true,
    "scenarioIds": [
      "6iun3l2s-cj8k-gti7-0fb2-bq9xa7i80ja",
      "ay6iz5m1-5zfh-e72t-57ao-9lybw65q3wi"
    ],
    "rubricId": "rubricId_1",
    "defaultSimulation": "defaultSimulation_1",
    "practiceSimulation": "practiceSimulation_1"
  },
  {
    "id": "mhj6t6ye-bbj2-pw8g-hcz7-bexgs5du8sa",
    "createdAt": "2025-07-25T02:37:04.077Z",
    "updatedAt": "2025-07-25T02:37:04.077Z",
    "title": "Lab Safety Training",
    "active": false,
    "scenarioIds": [
      "6iun3l2s-cj8k-gti7-0fb2-bq9xa7i80ja",
      "ay6iz5m1-5zfh-e72t-57ao-9lybw65q3wi"
    ],
    "rubricId": "rubricId_2",
    "defaultSimulation": "defaultSimulation_2",
    "practiceSimulation": "practiceSimulation_2"
  }
];

// SIMULATIONATTEMPTS MOCK DATA
export const simulationAttempts = [
  {
    "id": "bx9cfalf-2565-shdx-h26j-cur9lv8zch",
    "createdAt": "2025-07-25T02:37:04.077Z",
    "simulationId": "simulationId_1"
  }
];

// SIMULATIONCHATS MOCK DATA
export const simulationChats = [
  {
    "id": "6zlf2xhw-t7vd-d30l-5w1g-b0bkrdcp3e",
    "createdAt": "2025-07-25T02:37:04.077Z",
    "updatedAt": "2025-07-25T02:37:04.077Z",
    "completedAt": "2025-07-25T02:37:04.077Z",
    "title": "Simulation_chats 1",
    "scenarioId": "scenarioId_1",
    "attemptId": "attemptId_1",
    "completed": true
  }
];

// SIMULATIONMESSAGES MOCK DATA
export const simulationMessages = [
  {
    "id": "dq4x41od-9xfu-zagu-fict-s3ulbbufmd",
    "createdAt": "2025-07-25T02:37:04.077Z",
    "updatedAt": "2025-07-25T02:37:04.077Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query",
    "completed": false
  }
];

// SIMULATIONCHATGRADES MOCK DATA
export const simulationChatGrades = [
  {
    "id": "bm46yqsd-vftw-910b-c0g8-jmsl2c5w108",
    "createdAt": "2025-07-25T02:37:04.077Z",
    "passed": true,
    "score": 16,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1",
    "simulationChatId": "simulationChatId_1"
  }
];

// SIMULATIONCHATFEEDBACKS MOCK DATA
export const simulationChatFeedbacks = [
  {
    "id": "wcxjmlkf-0m50-dstq-dvkf-2jggasmom1",
    "createdAt": "2025-07-25T02:37:04.077Z",
    "standardId": "standardId_1",
    "simulationChatGradeId": "simulationChatGradeId_1",
    "total": 44
  }
];

// COHORTS MOCK DATA
export const cohorts = [
  {
    "id": "wemye1i7-gr86-0i79-vamp-5l8gch8e29q",
    "createdAt": "2025-07-25T02:37:04.077Z",
    "updatedAt": "2025-07-25T02:37:04.077Z",
    "title": "Fall 2024 Cohort",
    "active": true,
    "profileIds": [
      "auusw0yu-fiaj-7ckx-8zf9-wn2nm75crn",
      "0hwap0ix-2vcy-izn6-mtbh-b0903dqcl8b",
      "9isc8w2j-0nem-qyul-t73r-wbcwtxe0ih",
      "ume43jas-klm4-wq2u-b47u-c30zhbmhreh"
    ],
    "defaultCohort": "defaultCohort_1",
    "simulationIds": [
      "ij5v1uxs-zvat-o54j-7edh-raw3ld0e4tn",
      "mhj6t6ye-bbj2-pw8g-hcz7-bexgs5du8sa"
    ]
  },
  {
    "id": "n3ryx1lm-gbj3-tis0-ms7w-5id4mdgyjm5",
    "createdAt": "2025-07-25T02:37:04.077Z",
    "updatedAt": "2025-07-25T02:37:04.077Z",
    "title": "Spring 2024 Advanced",
    "description": "Advanced students in spring programs",
    "active": false,
    "profileIds": [
      "auusw0yu-fiaj-7ckx-8zf9-wn2nm75crn",
      "0hwap0ix-2vcy-izn6-mtbh-b0903dqcl8b",
      "9isc8w2j-0nem-qyul-t73r-wbcwtxe0ih",
      "ume43jas-klm4-wq2u-b47u-c30zhbmhreh"
    ],
    "defaultCohort": "defaultCohort_2",
    "simulationIds": [
      "ij5v1uxs-zvat-o54j-7edh-raw3ld0e4tn",
      "mhj6t6ye-bbj2-pw8g-hcz7-bexgs5du8sa"
    ]
  }
];

// VERIFICATIONTOKEN MOCK DATA
export const verificationToken = [
  {
    "identifier": "identifier_1",
    "expires": "2025-07-25T02:37:04.077Z",
    "token": "token_1"
  }
];

