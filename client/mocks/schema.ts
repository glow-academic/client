// Mock schema for the database, so we have mock data to work with
// Generated automatically by generate-mocks.js

// ACCOUNTS MOCK DATA
export const accounts = [
  {
    "id": 36,
    "userId": 88,
    "type": "type_1",
    "provider": "provider_1",
    "providerAccountId": "providerAccountId_1",
    "refreshToken": "refreshToken_1",
    "mode": "mode_1",
    "expiresAt": 59,
    "idToken": "idToken_1",
    "sessionState": "sessionState_1",
    "tokenType": "tokenType_1"
  }
];

// SESSIONS MOCK DATA
export const sessions = [
  {
    "id": 26,
    "userId": 74,
    "expires": "2025-08-10T17:22:57.019Z",
    "sessionToken": "sessionToken_1"
  }
];

// USERS MOCK DATA
export const users = [
  {
    "id": 65,
    "name": "Admin User"
  },
  {
    "id": 10,
    "name": "Instructional User",
    "email": "instructional@example.com",
    "emailVerified": "2025-08-10T17:22:57.019Z",
    "image": "image_2"
  },
  {
    "id": 2,
    "name": "Instructor User",
    "email": "instructor@example.com",
    "emailVerified": "2025-08-10T17:22:57.019Z",
    "image": "image_3"
  },
  {
    "id": 22
  }
];

// PROFILES MOCK DATA
export const profiles = [
  {
    "id": "m51id2hl-fuqb-e2ie-ttqp-e6gd41c2xr",
    "updatedAt": "2025-08-10T17:22:57.019Z",
    "userId": 65,
    "lastLogin": "2025-08-10T17:22:57.019Z",
    "firstName": "Admin",
    "lastName": "User",
    "alias": "admin-user",
    "viewedIntro": "viewedIntro_1",
    "viewedChat": "viewedChat_1",
    "createdAt": "2025-08-10T17:22:57.019Z",
    "role": "admin",
    "defaultProfile": "defaultProfile_1",
    "active": true,
    "lastActive": "2025-08-10T17:22:57.019Z"
  },
  {
    "id": "hn6lc6j9-kehv-snqv-ozm8-wgemm58hmi",
    "updatedAt": "2025-08-10T17:22:57.019Z",
    "userId": 10,
    "lastLogin": "2025-08-10T17:22:57.019Z",
    "firstName": "Instructional",
    "lastName": "User",
    "alias": "instructional-user",
    "viewedIntro": "viewedIntro_2",
    "viewedChat": "viewedChat_2",
    "createdAt": "2025-08-10T17:22:57.019Z",
    "role": "instructional",
    "defaultProfile": "defaultProfile_2",
    "active": false,
    "lastActive": "2025-08-10T17:22:57.019Z"
  },
  {
    "id": "zm8ewbq8-116k-pxh8-xswk-7gi2rw9uvfi",
    "updatedAt": "2025-08-10T17:22:57.019Z",
    "userId": 2,
    "lastLogin": "2025-08-10T17:22:57.019Z",
    "firstName": "Instructor",
    "lastName": "User",
    "alias": "instructor-user",
    "viewedIntro": "viewedIntro_3",
    "viewedChat": "viewedChat_3",
    "createdAt": "2025-08-10T17:22:57.019Z",
    "role": "instructor",
    "defaultProfile": "defaultProfile_3",
    "active": false,
    "lastActive": "2025-08-10T17:22:57.019Z"
  },
  {
    "id": "jogyiiyl-1r9u-9v95-0pz4-f0bgmq6wd9",
    "updatedAt": "2025-08-10T17:22:57.019Z",
    "userId": 22,
    "lastLogin": "2025-08-10T17:22:57.019Z",
    "firstName": "TA",
    "lastName": "User",
    "alias": "ta-user",
    "viewedIntro": "viewedIntro_4",
    "viewedChat": "viewedChat_4",
    "createdAt": "2025-08-10T17:22:57.019Z",
    "role": "ta",
    "defaultProfile": "defaultProfile_4",
    "active": false,
    "lastActive": "2025-08-10T17:22:57.019Z"
  }
];

// PROVIDERS MOCK DATA
export const providers = [
  {
    "id": "25yi7fak-saq1-5zij-xu4n-yvafbtkqnd",
    "createdAt": "2025-08-10T17:22:57.019Z",
    "updatedAt": "2025-08-10T17:22:57.019Z",
    "name": "Providers 1",
    "description": "Description for providers 1",
    "apiKey": "apiKey_1",
    "baseUrl": "baseUrl_1"
  }
];

// MODELRUNS MOCK DATA
export const modelRuns = [
  {
    "id": "edet90gc-edg4-hncn-18k7-1u2p2sgf0dh",
    "createdAt": "2025-08-10T17:22:57.019Z",
    "updatedAt": "2025-08-10T17:22:57.019Z",
    "modelId": "modelId_1",
    "inputTokens": "inputTokens_1",
    "outputTokens": "outputTokens_1"
  }
];

// DOCUMENTS MOCK DATA
export const documents = [
  {
    "id": "x3972thl-o7a6-ri2z-f4dq-85efzj1bib5",
    "createdAt": "2025-08-10T17:22:57.019Z",
    "updatedAt": "2025-08-10T17:22:57.019Z",
    "name": "Documents 1",
    "filePath": "filePath_1",
    "mimeType": "mimeType_1",
    "type": "homework",
    "classified": true,
    "fileId": "fileId_1",
    "active": true,
    "tags": [
      "tags_1"
    ]
  }
];

// MODELS MOCK DATA
export const models = [
  {
    "id": "k2mye1fz-mjwb-emrs-9pph-ocevs0sjnzn",
    "createdAt": "2025-08-10T17:22:57.019Z",
    "updatedAt": "2025-08-10T17:22:57.019Z",
    "name": "Models 1",
    "description": "Description for models 1",
    "providerId": "providerId_1",
    "active": true,
    "inputPpm": "inputPpm_1",
    "outputPpm": "outputPpm_1"
  }
];

// RUBRICS MOCK DATA
export const rubrics = [
  {
    "id": "mjgusw4u-f8mg-dt9c-n5mq-5ao0vqamfya",
    "createdAt": "2025-08-10T17:22:57.019Z",
    "updatedAt": "2025-08-10T17:22:57.019Z",
    "name": "Math Problem Solving Rubric",
    "description": "Evaluates mathematical reasoning and problem-solving skills",
    "points": 4,
    "passPoints": "passPoints_1",
    "defaultRubric": "defaultRubric_1",
    "active": true
  },
  {
    "id": "2hib32um-yp99-ewd3-8dj3-18uf0ser7iq",
    "createdAt": "2025-08-10T17:22:57.019Z",
    "updatedAt": "2025-08-10T17:22:57.019Z",
    "name": "Science Lab Rubric",
    "description": "Assesses lab technique and safety knowledge",
    "points": 12,
    "passPoints": "passPoints_2",
    "defaultRubric": "defaultRubric_2",
    "active": false
  }
];

// STANDARDGROUPS MOCK DATA
export const standardGroups = [
  {
    "id": "ypmr74sy-zzh8-4u27-c74b-0cfvoezfbz4j",
    "createdAt": "2025-08-10T17:22:57.019Z",
    "name": "Standard_groups 1",
    "shortName": "shortName_1",
    "description": "Description for standard_groups 1",
    "points": 75,
    "passPoints": "passPoints_1",
    "rubricId": "rubricId_1"
  }
];

// STANDARDS MOCK DATA
export const standards = [
  {
    "id": "w7er0g5i-ef7n-1dtt-c7b9-xyg480pqhw",
    "createdAt": "2025-08-10T17:22:57.019Z",
    "name": "Standards 1",
    "description": "Description for standards 1",
    "points": 9,
    "standardGroupId": "standardGroupId_1"
  }
];

// APPLOGS MOCK DATA
export const appLogs = [
  {
    "id": 33,
    "level": "level_1",
    "message": "message_1",
    "context": {},
    "createdAt": "2025-08-10T17:22:57.019Z"
  }
];

// APPFEEDBACK MOCK DATA
export const appFeedback = [
  {
    "id": 89,
    "createdAt": "2025-08-10T17:22:57.019Z",
    "profileId": "profileId_1",
    "type": "feature",
    "message": "message_1"
  }
];

// ASSISTANTMESSAGES MOCK DATA
export const assistantMessages = [
  {
    "id": "l2qk6l68-5p05-l5lq-z3wq-4m0g4kfqjn2",
    "createdAt": "2025-08-10T17:22:57.019Z",
    "updatedAt": "2025-08-10T17:22:57.019Z",
    "completedAt": "2025-08-10T17:22:57.019Z",
    "chatId": "chatId_1",
    "role": "user",
    "content": "content_1",
    "completed": false
  }
];

// ASSISTANTCHATS MOCK DATA
export const assistantChats = [
  {
    "id": "2xhc9sbd-u4v4-46kf-hhp4-rqumz6vt1a",
    "createdAt": "2025-08-10T17:22:57.019Z",
    "updatedAt": "2025-08-10T17:22:57.019Z",
    "title": "Assistant_chats 1",
    "profileId": "profileId_1"
  }
];

// ASSISTANTTOOLCALLS MOCK DATA
export const assistantToolCalls = [
  {
    "id": "wwjp064w-9eqa-5iqk-7yxl-rja3ye3amrj",
    "createdAt": "2025-08-10T17:22:57.019Z",
    "updatedAt": "2025-08-10T17:22:57.019Z",
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
    "id": "d2896slk-f8vt-b1z7-ikvs-escj9y3evvd",
    "createdAt": "2025-08-10T17:22:57.019Z",
    "updatedAt": "2025-08-10T17:22:57.019Z",
    "name": "Personas 1",
    "description": "Description for personas 1",
    "systemPrompt": "systemPrompt_1",
    "temperature": "temperature_1",
    "defaultPersona": "defaultPersona_1",
    "color": "color_1",
    "icon": "icon_1",
    "modelId": "modelId_1",
    "reasoning": "minimal",
    "active": true
  }
];

// AGENTS MOCK DATA
export const agents = [
  {
    "id": "lqinj696-ew7w-8464-asdz-qf8bsxc61q",
    "createdAt": "2025-08-10T17:22:57.019Z",
    "updatedAt": "2025-08-10T17:22:57.019Z",
    "name": "Math Tutor Agent",
    "description": "Helps students with mathematical concepts and problem-solving",
    "systemPrompt": "You are a helpful math tutor. Guide students through problems step by step.",
    "temperature": "temperature_1",
    "modelId": "modelId_1",
    "reasoning": "minimal"
  },
  {
    "id": "xfgotlp6-8ysj-i01c-guh7-x1bxavev57e",
    "createdAt": "2025-08-10T17:22:57.019Z",
    "updatedAt": "2025-08-10T17:22:57.019Z",
    "name": "Science Helper Bot",
    "description": "Assists with scientific inquiries and experiments",
    "systemPrompt": "You are a science assistant. Help students understand scientific concepts.",
    "temperature": "temperature_2",
    "modelId": "modelId_2",
    "reasoning": "low"
  }
];

// SIMULATIONATTEMPTS MOCK DATA
export const simulationAttempts = [
  {
    "id": "3hmpezlk-p8au-ky1m-6zbt-w0zhluzjn7m",
    "createdAt": "2025-08-10T17:22:57.019Z",
    "profileId": "profileId_1",
    "simulationId": "simulationId_1"
  }
];

// PARAMETERS MOCK DATA
export const parameters = [
  {
    "id": "93w11amq-xmvq-ea5i-quqq-udyivg7wlu",
    "createdAt": "2025-08-10T17:22:57.019Z",
    "updatedAt": "2025-08-10T17:22:57.019Z",
    "name": "Parameters 1",
    "description": "Description for parameters 1",
    "numerical": false,
    "active": true
  }
];

// PARAMETERITEMS MOCK DATA
export const parameterItems = [
  {
    "id": "729lmgoi-bvw5-e8lt-ylqd-u1d7pxg0hwr",
    "createdAt": "2025-08-10T17:22:57.019Z",
    "updatedAt": "2025-08-10T17:22:57.019Z",
    "name": "Parameter_items 1",
    "description": "Description for parameter_items 1",
    "value": "value_1",
    "parameterId": "parameterId_1",
    "defaultItem": "defaultItem_1"
  }
];

// SCENARIOS MOCK DATA
export const scenarios = [
  {
    "id": "wbt8j5tg-9l1f-0ace-5u3j-fwz3lrmhm9e",
    "createdAt": "2025-08-10T17:22:57.019Z",
    "updatedAt": "2025-08-10T17:22:57.019Z",
    "name": "Algebra Problem Solving",
    "description": "Students work through complex algebra problems with AI assistance",
    "personaId": "personaId_1",
    "parameterItemIds": [
      "parameterItemIds_1"
    ],
    "documentIds": [
      "documentIds_1"
    ],
    "defaultScenario": "defaultScenario_1",
    "practiceScenario": "practiceScenario_1",
    "generated": true,
    "parentId": "parentId_1",
    "active": true
  },
  {
    "id": "cou9k0l7-ws1j-pznz-qk9x-wzghq76cdp",
    "createdAt": "2025-08-10T17:22:57.019Z",
    "updatedAt": "2025-08-10T17:22:57.019Z",
    "name": "Chemistry Lab Safety",
    "description": "Students learn lab safety protocols through interactive scenarios",
    "personaId": "personaId_2",
    "documentIds": [
      "documentIds_2"
    ],
    "defaultScenario": "defaultScenario_2",
    "practiceScenario": "practiceScenario_2",
    "generated": false,
    "parentId": "parentId_2",
    "active": false
  }
];

// SIMULATIONCHATS MOCK DATA
export const simulationChats = [
  {
    "id": "lyxji8kd-b9oy-ed0q-tu3v-j1bl9shoxve",
    "createdAt": "2025-08-10T17:22:57.019Z",
    "updatedAt": "2025-08-10T17:22:57.019Z",
    "completedAt": "2025-08-10T17:22:57.019Z",
    "title": "Simulation_chats 1",
    "scenarioId": "scenarioId_1",
    "attemptId": "attemptId_1",
    "completed": false
  }
];

// SIMULATIONS MOCK DATA
export const simulations = [
  {
    "id": "vx99ph0j-llyc-m4vx-jkos-ags9tvk606f",
    "createdAt": "2025-08-10T17:22:57.019Z",
    "updatedAt": "2025-08-10T17:22:57.019Z",
    "title": "Math Practice Simulation",
    "timeLimit": "timeLimit_1",
    "active": true,
    "scenarioIds": [
      "wbt8j5tg-9l1f-0ace-5u3j-fwz3lrmhm9e",
      "cou9k0l7-ws1j-pznz-qk9x-wzghq76cdp"
    ],
    "rubricId": "rubricId_1",
    "defaultSimulation": "defaultSimulation_1",
    "practiceSimulation": "practiceSimulation_1"
  },
  {
    "id": "7hhnb0qy-c04q-mcux-n5eu-y6rpt44z9b",
    "createdAt": "2025-08-10T17:22:57.019Z",
    "updatedAt": "2025-08-10T17:22:57.019Z",
    "title": "Lab Safety Training",
    "timeLimit": "timeLimit_2",
    "active": false,
    "scenarioIds": [
      "wbt8j5tg-9l1f-0ace-5u3j-fwz3lrmhm9e",
      "cou9k0l7-ws1j-pznz-qk9x-wzghq76cdp"
    ],
    "rubricId": "rubricId_2",
    "defaultSimulation": "defaultSimulation_2",
    "practiceSimulation": "practiceSimulation_2"
  }
];

// SIMULATIONMESSAGES MOCK DATA
export const simulationMessages = [
  {
    "id": "d3qvyhve-fmf4-dqwd-rhd7-csgaumv68f5",
    "createdAt": "2025-08-10T17:22:57.019Z",
    "updatedAt": "2025-08-10T17:22:57.019Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query",
    "completed": false
  }
];

// SIMULATIONCHATGRADES MOCK DATA
export const simulationChatGrades = [
  {
    "id": "od8itt6c-mvu3-4y9h-l4rh-xs8uob6wli9",
    "createdAt": "2025-08-10T17:22:57.019Z",
    "passed": false,
    "score": 49,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1",
    "simulationChatId": "simulationChatId_1"
  }
];

// SIMULATIONCHATFEEDBACKS MOCK DATA
export const simulationChatFeedbacks = [
  {
    "id": "dsmsl9sa-dasa-h1sv-z01f-5swupdx8x7d",
    "createdAt": "2025-08-10T17:22:57.019Z",
    "standardId": "standardId_1",
    "simulationChatGradeId": "simulationChatGradeId_1",
    "total": 38,
    "feedback": "feedback_1"
  }
];

// COHORTS MOCK DATA
export const cohorts = [
  {
    "id": "u5bfufl9-bs67-rix1-0zdj-oz8mj9utyrr",
    "createdAt": "2025-08-10T17:22:57.019Z",
    "updatedAt": "2025-08-10T17:22:57.019Z",
    "title": "Fall 2024 Cohort",
    "active": true,
    "profileIds": [
      "m51id2hl-fuqb-e2ie-ttqp-e6gd41c2xr",
      "hn6lc6j9-kehv-snqv-ozm8-wgemm58hmi",
      "zm8ewbq8-116k-pxh8-xswk-7gi2rw9uvfi",
      "jogyiiyl-1r9u-9v95-0pz4-f0bgmq6wd9"
    ],
    "defaultCohort": "defaultCohort_1",
    "simulationIds": [
      "vx99ph0j-llyc-m4vx-jkos-ags9tvk606f",
      "7hhnb0qy-c04q-mcux-n5eu-y6rpt44z9b"
    ]
  },
  {
    "id": "9roroquh-hts6-xr0d-gsgi-sk4937kwee",
    "createdAt": "2025-08-10T17:22:57.019Z",
    "updatedAt": "2025-08-10T17:22:57.019Z",
    "title": "Spring 2024 Advanced",
    "description": "Advanced students in spring programs",
    "active": false,
    "profileIds": [
      "m51id2hl-fuqb-e2ie-ttqp-e6gd41c2xr",
      "hn6lc6j9-kehv-snqv-ozm8-wgemm58hmi",
      "zm8ewbq8-116k-pxh8-xswk-7gi2rw9uvfi",
      "jogyiiyl-1r9u-9v95-0pz4-f0bgmq6wd9"
    ],
    "defaultCohort": "defaultCohort_2",
    "simulationIds": [
      "vx99ph0j-llyc-m4vx-jkos-ags9tvk606f",
      "7hhnb0qy-c04q-mcux-n5eu-y6rpt44z9b"
    ]
  }
];

// VERIFICATIONTOKEN MOCK DATA
export const verificationToken = [
  {
    "identifier": "identifier_1",
    "expires": "2025-08-10T17:22:57.019Z",
    "token": "token_1"
  }
];

