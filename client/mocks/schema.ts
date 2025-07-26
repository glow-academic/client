// Mock schema for the database, so we have mock data to work with
// Generated automatically by generate-mocks.js

// ACCOUNTS MOCK DATA
export const accounts = [
  {
    "id": 20,
    "userId": 17,
    "type": "type_1",
    "provider": "provider_1",
    "providerAccountId": "providerAccountId_1",
    "refreshToken": "refreshToken_1",
    "mode": "mode_1",
    "scope": "scope_1",
    "sessionState": "sessionState_1",
    "tokenType": "tokenType_1"
  }
];

// SESSIONS MOCK DATA
export const sessions = [
  {
    "id": 45,
    "userId": 17,
    "expires": "2025-07-26T23:47:39.245Z",
    "sessionToken": "sessionToken_1"
  }
];

// DOCUMENTS MOCK DATA
export const documents = [
  {
    "id": "hsf3qx3g-y8us-g6e4-2kj8-he306nrv6ld",
    "createdAt": "2025-07-26T23:47:39.245Z",
    "updatedAt": "2025-07-26T23:47:39.245Z",
    "name": "Documents 1",
    "filePath": "filePath_1",
    "mimeType": "mimeType_1",
    "type": "homework",
    "classified": true,
    "active": true
  }
];

// USERS MOCK DATA
export const users = [
  {
    "id": 67,
    "name": "Admin User",
    "email": "admin@example.com",
    "emailVerified": "2025-07-26T23:47:39.245Z",
    "image": "image_1"
  },
  {
    "id": 57,
    "name": "Instructional User",
    "email": "instructional@example.com",
    "emailVerified": "2025-07-26T23:47:39.245Z",
    "image": "image_2"
  },
  {
    "id": 82,
    "name": "Instructor User",
    "emailVerified": "2025-07-26T23:47:39.245Z"
  },
  {
    "id": 79,
    "name": "TA User",
    "email": "ta@example.com",
    "image": "image_4"
  }
];

// PROFILES MOCK DATA
export const profiles = [
  {
    "id": "mkqt67j4-jz6o-nvdw-zpqe-sll9wnah11",
    "updatedAt": "2025-07-26T23:47:39.245Z",
    "lastLogin": "2025-07-26T23:47:39.245Z",
    "firstName": "Admin",
    "lastName": "User",
    "alias": "admin-user",
    "viewedIntro": "viewedIntro_1",
    "viewedChat": "viewedChat_1",
    "createdAt": "2025-07-26T23:47:39.245Z",
    "role": "admin",
    "defaultProfile": "defaultProfile_1",
    "active": true,
    "lastActive": "2025-07-26T23:47:39.245Z",
    "userId": 67
  },
  {
    "id": "o688lq12-owbk-yj4x-z5oj-4ml1ql7zyng",
    "updatedAt": "2025-07-26T23:47:39.245Z",
    "lastLogin": "2025-07-26T23:47:39.245Z",
    "firstName": "Instructional",
    "lastName": "User",
    "alias": "instructional-user",
    "viewedIntro": "viewedIntro_2",
    "viewedChat": "viewedChat_2",
    "createdAt": "2025-07-26T23:47:39.245Z",
    "role": "instructional",
    "defaultProfile": "defaultProfile_2",
    "active": false,
    "lastActive": "2025-07-26T23:47:39.245Z",
    "userId": 57
  },
  {
    "id": "0bpj36qj-o274-8fg1-swl5-mb1rx6t2bl",
    "updatedAt": "2025-07-26T23:47:39.245Z",
    "userId": 82,
    "lastLogin": "2025-07-26T23:47:39.245Z",
    "firstName": "Instructor",
    "lastName": "User",
    "alias": "instructor-user",
    "viewedIntro": "viewedIntro_3",
    "viewedChat": "viewedChat_3",
    "createdAt": "2025-07-26T23:47:39.245Z",
    "role": "instructor",
    "defaultProfile": "defaultProfile_3",
    "active": false,
    "lastActive": "2025-07-26T23:47:39.245Z"
  },
  {
    "id": "yy5nqk1g-yrg0-kcsb-n8si-daxpk49rv77",
    "updatedAt": "2025-07-26T23:47:39.245Z",
    "userId": 79,
    "lastLogin": "2025-07-26T23:47:39.245Z",
    "firstName": "TA",
    "lastName": "User",
    "alias": "ta-user",
    "viewedIntro": "viewedIntro_4",
    "viewedChat": "viewedChat_4",
    "createdAt": "2025-07-26T23:47:39.245Z",
    "role": "ta",
    "defaultProfile": "defaultProfile_4",
    "active": false,
    "lastActive": "2025-07-26T23:47:39.245Z"
  }
];

// PROVIDERS MOCK DATA
export const providers = [
  {
    "id": "mgnszx8x-qvdb-9bmr-cf75-fpijirokfwj",
    "createdAt": "2025-07-26T23:47:39.245Z",
    "updatedAt": "2025-07-26T23:47:39.245Z",
    "name": "Providers 1",
    "description": "Description for providers 1",
    "apiKey": "apiKey_1"
  }
];

// MODELS MOCK DATA
export const models = [
  {
    "id": "ovy7nd1x-iyet-vk8r-oxb2-rontrkge7j9",
    "createdAt": "2025-07-26T23:47:39.245Z",
    "updatedAt": "2025-07-26T23:47:39.245Z",
    "name": "Models 1",
    "description": "Description for models 1",
    "providerId": "providerId_1",
    "active": true
  }
];

// RUBRICS MOCK DATA
export const rubrics = [
  {
    "id": "vk3te88z-tqh5-l90t-8rlh-s1uit4xs44h",
    "createdAt": "2025-07-26T23:47:39.245Z",
    "updatedAt": "2025-07-26T23:47:39.245Z",
    "name": "Math Problem Solving Rubric",
    "description": "Evaluates mathematical reasoning and problem-solving skills",
    "points": 54,
    "passPoints": "passPoints_1",
    "defaultRubric": "defaultRubric_1",
    "active": true
  },
  {
    "id": "2l5d81mz-cies-bqj7-jrjy-vl4m7zyje8g",
    "createdAt": "2025-07-26T23:47:39.245Z",
    "updatedAt": "2025-07-26T23:47:39.245Z",
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
    "id": "8yty1k3r-bu5j-vt3s-a2xa-ety1fystvl",
    "createdAt": "2025-07-26T23:47:39.245Z",
    "name": "Standard_groups 1",
    "shortName": "shortName_1",
    "description": "Description for standard_groups 1",
    "points": 43,
    "passPoints": "passPoints_1",
    "rubricId": "rubricId_1"
  }
];

// APPLOGS MOCK DATA
export const appLogs = [
  {
    "id": 59,
    "level": "level_1",
    "createdAt": "2025-07-26T23:47:39.245Z"
  }
];

// STANDARDS MOCK DATA
export const standards = [
  {
    "id": "ak7vvb9b-whmr-pede-393l-gx25g9iawr9",
    "createdAt": "2025-07-26T23:47:39.245Z",
    "name": "Standards 1",
    "description": "Description for standards 1",
    "points": 61,
    "standardGroupId": "standardGroupId_1"
  }
];

// APPFEEDBACK MOCK DATA
export const appFeedback = [
  {
    "id": 74,
    "createdAt": "2025-07-26T23:47:39.245Z",
    "profileId": "profileId_1",
    "type": "feature",
    "message": "message_1"
  }
];

// ASSISTANTCHATS MOCK DATA
export const assistantChats = [
  {
    "id": "hlno1f75-0mop-hh4h-wy2e-pptm4kj0x",
    "createdAt": "2025-07-26T23:47:39.245Z",
    "updatedAt": "2025-07-26T23:47:39.245Z",
    "title": "Assistant_chats 1",
    "profileId": "profileId_1",
    "traceId": "traceId_1"
  }
];

// ASSISTANTMESSAGES MOCK DATA
export const assistantMessages = [
  {
    "id": "g8uagiet-fc0y-zphv-84jk-kodpy8ondz",
    "createdAt": "2025-07-26T23:47:39.245Z",
    "updatedAt": "2025-07-26T23:47:39.245Z",
    "completedAt": "2025-07-26T23:47:39.245Z",
    "chatId": "chatId_1",
    "role": "user",
    "content": "content_1",
    "completed": false
  }
];

// ASSISTANTTOOLCALLS MOCK DATA
export const assistantToolCalls = [
  {
    "id": "2s3cbwek-6km0-b70y-kv4p-iicwwk97v1k",
    "createdAt": "2025-07-26T23:47:39.245Z",
    "updatedAt": "2025-07-26T23:47:39.245Z",
    "chatId": "chatId_1",
    "toolName": "toolName_1",
    "toolType": "toolType_1",
    "toolArguments": "toolArguments_1",
    "toolResult": "toolResult_1",
    "completed": false
  }
];

// PERSONAS MOCK DATA
export const personas = [
  {
    "id": "571fqkzo-ezhv-9603-2wg1-cd6p60ya3e8",
    "createdAt": "2025-07-26T23:47:39.245Z",
    "updatedAt": "2025-07-26T23:47:39.245Z",
    "name": "Personas 1",
    "description": "Description for personas 1",
    "systemPrompt": "systemPrompt_1",
    "temperature": 0.03,
    "defaultPersona": "defaultPersona_1",
    "color": "color_1",
    "modelId": "modelId_1",
    "reasoning": "low"
  }
];

// SYSTEMAGENTS MOCK DATA
export const systemAgents = [
  {
    "id": "tp2zfmr8-hx0b-04w9-vg98-jsi35f6may",
    "createdAt": "2025-07-26T23:47:39.245Z",
    "updatedAt": "2025-07-26T23:47:39.245Z",
    "name": "System_agents 1",
    "description": "Description for system_agents 1",
    "systemPrompt": "systemPrompt_1",
    "temperature": 0.71,
    "reasoning": "low"
  }
];

// SIMULATIONATTEMPTS MOCK DATA
export const simulationAttempts = [
  {
    "id": "qccutqza-g31z-vxlt-oizq-pzefw75bmmk",
    "createdAt": "2025-07-26T23:47:39.245Z",
    "profileId": "profileId_1",
    "simulationId": "simulationId_1"
  }
];

// PARAMETERS MOCK DATA
export const parameters = [
  {
    "id": "3yiomnwd-jqyf-yagr-h5i3-himg6ybyjht",
    "createdAt": "2025-07-26T23:47:39.245Z",
    "updatedAt": "2025-07-26T23:47:39.245Z",
    "name": "Parameters 1",
    "description": "Description for parameters 1",
    "numerical": false
  }
];

// PARAMETERITEMS MOCK DATA
export const parameterItems = [
  {
    "id": "6q46zu8a-anzh-r4md-s2u0-u6qioef97sb",
    "createdAt": "2025-07-26T23:47:39.245Z",
    "updatedAt": "2025-07-26T23:47:39.245Z",
    "name": "Parameter_items 1",
    "description": "Description for parameter_items 1",
    "value": "value_1",
    "parameterId": "parameterId_1"
  }
];

// SCENARIOS MOCK DATA
export const scenarios = [
  {
    "id": "br5xlque-hxng-w2g8-e8oj-geb429ox9uk",
    "createdAt": "2025-07-26T23:47:39.245Z",
    "updatedAt": "2025-07-26T23:47:39.245Z",
    "name": "Algebra Problem Solving",
    "description": "Students work through complex algebra problems with AI assistance",
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
    "id": "78aafda9-mr9l-ppqa-ph8r-29e0s96mq3h",
    "createdAt": "2025-07-26T23:47:39.245Z",
    "updatedAt": "2025-07-26T23:47:39.245Z",
    "name": "Chemistry Lab Safety",
    "description": "Students learn lab safety protocols through interactive scenarios",
    "personaId": "personaId_2",
    "parameterItemIds": [
      "parameterItemIds_2"
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
    "id": "2t975cv4-ds53-7gyo-7tmj-bnalr9r7te",
    "createdAt": "2025-07-26T23:47:39.245Z",
    "updatedAt": "2025-07-26T23:47:39.245Z",
    "title": "Simulation_chats 1",
    "scenarioId": "scenarioId_1",
    "attemptId": "attemptId_1",
    "completed": true,
    "traceId": "traceId_1"
  }
];

// SIMULATIONS MOCK DATA
export const simulations = [
  {
    "id": "tn5che68-79cm-akfo-5o7i-6xv8aw7m2vs",
    "createdAt": "2025-07-26T23:47:39.245Z",
    "updatedAt": "2025-07-26T23:47:39.245Z",
    "title": "Math Practice Simulation",
    "active": true,
    "scenarioIds": [
      "br5xlque-hxng-w2g8-e8oj-geb429ox9uk",
      "78aafda9-mr9l-ppqa-ph8r-29e0s96mq3h"
    ],
    "rubricId": "rubricId_1",
    "defaultSimulation": "defaultSimulation_1",
    "practiceSimulation": "practiceSimulation_1"
  },
  {
    "id": "s5hiw4ds-imwe-ehgh-f53w-soqb4lgiu8",
    "createdAt": "2025-07-26T23:47:39.245Z",
    "updatedAt": "2025-07-26T23:47:39.245Z",
    "title": "Lab Safety Training",
    "active": false,
    "scenarioIds": [
      "br5xlque-hxng-w2g8-e8oj-geb429ox9uk",
      "78aafda9-mr9l-ppqa-ph8r-29e0s96mq3h"
    ],
    "rubricId": "rubricId_2",
    "defaultSimulation": "defaultSimulation_2",
    "practiceSimulation": "practiceSimulation_2"
  }
];

// SIMULATIONMESSAGES MOCK DATA
export const simulationMessages = [
  {
    "id": "2w0m28fg-h8lp-me4z-pupr-qrqgfpm8tos",
    "createdAt": "2025-07-26T23:47:39.245Z",
    "updatedAt": "2025-07-26T23:47:39.245Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query",
    "completed": true
  }
];

// SIMULATIONCHATGRADES MOCK DATA
export const simulationChatGrades = [
  {
    "id": "pbw92ivd-qe0l-5z9y-e09m-220lujjiv3f",
    "createdAt": "2025-07-26T23:47:39.245Z",
    "passed": false,
    "score": 34,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1",
    "simulationChatId": "simulationChatId_1"
  }
];

// SIMULATIONCHATFEEDBACKS MOCK DATA
export const simulationChatFeedbacks = [
  {
    "id": "dcz2o6v2-2ht3-olkg-fxe9-ndy4slywjqs",
    "createdAt": "2025-07-26T23:47:39.245Z",
    "standardId": "standardId_1",
    "simulationChatGradeId": "simulationChatGradeId_1",
    "total": 24,
    "feedback": "feedback_1"
  }
];

// COHORTS MOCK DATA
export const cohorts = [
  {
    "id": "3w33zszj-39hh-ylvo-oo83-q23em4l2jk",
    "createdAt": "2025-07-26T23:47:39.245Z",
    "updatedAt": "2025-07-26T23:47:39.245Z",
    "title": "Fall 2024 Cohort",
    "active": true,
    "profileIds": [
      "mkqt67j4-jz6o-nvdw-zpqe-sll9wnah11",
      "o688lq12-owbk-yj4x-z5oj-4ml1ql7zyng",
      "0bpj36qj-o274-8fg1-swl5-mb1rx6t2bl",
      "yy5nqk1g-yrg0-kcsb-n8si-daxpk49rv77"
    ],
    "defaultCohort": "defaultCohort_1",
    "simulationIds": [
      "tn5che68-79cm-akfo-5o7i-6xv8aw7m2vs",
      "s5hiw4ds-imwe-ehgh-f53w-soqb4lgiu8"
    ]
  },
  {
    "id": "73q5p3wp-mlmp-jk86-qcri-jzxv3tuzs1s",
    "createdAt": "2025-07-26T23:47:39.245Z",
    "updatedAt": "2025-07-26T23:47:39.245Z",
    "title": "Spring 2024 Advanced",
    "description": "Advanced students in spring programs",
    "active": false,
    "profileIds": [
      "mkqt67j4-jz6o-nvdw-zpqe-sll9wnah11",
      "o688lq12-owbk-yj4x-z5oj-4ml1ql7zyng",
      "0bpj36qj-o274-8fg1-swl5-mb1rx6t2bl",
      "yy5nqk1g-yrg0-kcsb-n8si-daxpk49rv77"
    ],
    "defaultCohort": "defaultCohort_2",
    "simulationIds": [
      "tn5che68-79cm-akfo-5o7i-6xv8aw7m2vs",
      "s5hiw4ds-imwe-ehgh-f53w-soqb4lgiu8"
    ]
  }
];

// VERIFICATIONTOKEN MOCK DATA
export const verificationToken = [
  {
    "identifier": "identifier_1",
    "expires": "2025-07-26T23:47:39.245Z",
    "token": "token_1"
  }
];

