// Mock schema for the database, so we have mock data to work with
// Generated automatically by generate-mocks.js

// ACCOUNTS MOCK DATA
export const accounts = [
  {
    "id": 79,
    "userId": 5,
    "type": "type_1",
    "provider": "provider_1",
    "providerAccountId": "providerAccountId_1",
    "accessToken": "accessToken_1",
    "mode": "mode_1",
    "expiresAt": 83,
    "sessionState": "sessionState_1",
    "tokenType": "tokenType_1"
  }
];

// SESSIONS MOCK DATA
export const sessions = [
  {
    "id": 65,
    "userId": 23,
    "expires": "2025-07-27T00:12:29.903Z",
    "sessionToken": "sessionToken_1"
  }
];

// DOCUMENTS MOCK DATA
export const documents = [
  {
    "id": "y6viah3i-681k-cilq-tyxz-yc0j7mm6t1",
    "createdAt": "2025-07-27T00:12:29.903Z",
    "updatedAt": "2025-07-27T00:12:29.903Z",
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
    "id": 23,
    "email": "admin@example.com",
    "image": "image_1"
  },
  {
    "id": 100,
    "email": "instructional@example.com",
    "emailVerified": "2025-07-27T00:12:29.903Z",
    "image": "image_2"
  },
  {
    "id": 15,
    "name": "Instructor User",
    "email": "instructor@example.com",
    "image": "image_3"
  },
  {
    "id": 87,
    "name": "TA User",
    "email": "ta@example.com",
    "emailVerified": "2025-07-27T00:12:29.903Z"
  }
];

// PROFILES MOCK DATA
export const profiles = [
  {
    "id": "3rzuo819-vu92-bt8u-jsrb-wpljz10qe1",
    "updatedAt": "2025-07-27T00:12:29.903Z",
    "userId": 23,
    "lastLogin": "2025-07-27T00:12:29.903Z",
    "firstName": "Admin",
    "lastName": "User",
    "alias": "admin-user",
    "viewedIntro": "viewedIntro_1",
    "viewedChat": "viewedChat_1",
    "createdAt": "2025-07-27T00:12:29.903Z",
    "role": "admin",
    "defaultProfile": "defaultProfile_1",
    "active": true,
    "lastActive": "2025-07-27T00:12:29.903Z"
  },
  {
    "id": "oei1jeix-f230-cubc-68gq-oldc539j08",
    "updatedAt": "2025-07-27T00:12:29.903Z",
    "userId": 100,
    "lastLogin": "2025-07-27T00:12:29.903Z",
    "firstName": "Instructional",
    "lastName": "User",
    "alias": "instructional-user",
    "viewedIntro": "viewedIntro_2",
    "viewedChat": "viewedChat_2",
    "createdAt": "2025-07-27T00:12:29.903Z",
    "role": "instructional",
    "defaultProfile": "defaultProfile_2",
    "active": false,
    "lastActive": "2025-07-27T00:12:29.903Z"
  },
  {
    "id": "15rmsu47-iqfj-68ic-5kyy-6q95ql10r2d",
    "updatedAt": "2025-07-27T00:12:29.903Z",
    "userId": 15,
    "lastLogin": "2025-07-27T00:12:29.903Z",
    "firstName": "Instructor",
    "lastName": "User",
    "alias": "instructor-user",
    "viewedIntro": "viewedIntro_3",
    "viewedChat": "viewedChat_3",
    "createdAt": "2025-07-27T00:12:29.903Z",
    "role": "instructor",
    "defaultProfile": "defaultProfile_3",
    "active": false,
    "lastActive": "2025-07-27T00:12:29.903Z"
  },
  {
    "id": "6cfjbyhz-gdls-uw9t-mxsz-n6uowe2tc0g",
    "updatedAt": "2025-07-27T00:12:29.903Z",
    "lastLogin": "2025-07-27T00:12:29.903Z",
    "firstName": "TA",
    "lastName": "User",
    "alias": "ta-user",
    "viewedIntro": "viewedIntro_4",
    "viewedChat": "viewedChat_4",
    "createdAt": "2025-07-27T00:12:29.903Z",
    "role": "ta",
    "defaultProfile": "defaultProfile_4",
    "active": false,
    "lastActive": "2025-07-27T00:12:29.903Z",
    "userId": 87
  }
];

// PROVIDERS MOCK DATA
export const providers = [
  {
    "id": "7l04k2zp-eg3n-fmph-ml32-vd14jt0x1r",
    "createdAt": "2025-07-27T00:12:29.903Z",
    "updatedAt": "2025-07-27T00:12:29.903Z",
    "name": "Providers 1",
    "description": "Description for providers 1",
    "apiKey": "apiKey_1",
    "baseUrl": "baseUrl_1"
  }
];

// MODELS MOCK DATA
export const models = [
  {
    "id": "g7hqaw46-l0rh-vw86-p1zn-p3uik1g5ikg",
    "createdAt": "2025-07-27T00:12:29.903Z",
    "updatedAt": "2025-07-27T00:12:29.903Z",
    "name": "Models 1",
    "description": "Description for models 1",
    "providerId": "providerId_1",
    "active": true
  }
];

// RUBRICS MOCK DATA
export const rubrics = [
  {
    "id": "0ibdz4y5-pu6a-egk4-p8pj-lh9cyfdg43",
    "createdAt": "2025-07-27T00:12:29.903Z",
    "updatedAt": "2025-07-27T00:12:29.903Z",
    "name": "Math Problem Solving Rubric",
    "description": "Evaluates mathematical reasoning and problem-solving skills",
    "points": 70,
    "passPoints": "passPoints_1",
    "defaultRubric": "defaultRubric_1",
    "active": true
  },
  {
    "id": "mla5aygn-k6vu-81ps-1kap-v0qacc6bltc",
    "createdAt": "2025-07-27T00:12:29.903Z",
    "updatedAt": "2025-07-27T00:12:29.903Z",
    "name": "Science Lab Rubric",
    "description": "Assesses lab technique and safety knowledge",
    "points": 69,
    "passPoints": "passPoints_2",
    "defaultRubric": "defaultRubric_2",
    "active": false
  }
];

// STANDARDGROUPS MOCK DATA
export const standardGroups = [
  {
    "id": "bao8w655-q9ez-8bfy-ul7z-ml81yp33dqq",
    "createdAt": "2025-07-27T00:12:29.903Z",
    "name": "Standard_groups 1",
    "shortName": "shortName_1",
    "description": "Description for standard_groups 1",
    "points": 42,
    "passPoints": "passPoints_1",
    "rubricId": "rubricId_1"
  }
];

// APPLOGS MOCK DATA
export const appLogs = [
  {
    "id": 46,
    "level": "level_1",
    "context": {},
    "createdAt": "2025-07-27T00:12:29.903Z"
  }
];

// STANDARDS MOCK DATA
export const standards = [
  {
    "id": "ix9ug9zv-z9y4-p46j-vp9y-fr1ahaqvn9",
    "createdAt": "2025-07-27T00:12:29.903Z",
    "name": "Standards 1",
    "description": "Description for standards 1",
    "points": 26,
    "standardGroupId": "standardGroupId_1"
  }
];

// APPFEEDBACK MOCK DATA
export const appFeedback = [
  {
    "id": 59,
    "createdAt": "2025-07-27T00:12:29.903Z",
    "profileId": "profileId_1",
    "type": "feature",
    "message": "message_1"
  }
];

// ASSISTANTCHATS MOCK DATA
export const assistantChats = [
  {
    "id": "150kex9l-srqe-fnep-ugfn-tsvlxn7cynt",
    "createdAt": "2025-07-27T00:12:29.903Z",
    "updatedAt": "2025-07-27T00:12:29.903Z",
    "title": "Assistant_chats 1",
    "profileId": "profileId_1",
    "traceId": "traceId_1"
  }
];

// ASSISTANTMESSAGES MOCK DATA
export const assistantMessages = [
  {
    "id": "pouw9o3h-krfb-rw5s-7fci-e7wol6w2dd7",
    "createdAt": "2025-07-27T00:12:29.903Z",
    "updatedAt": "2025-07-27T00:12:29.903Z",
    "completedAt": "2025-07-27T00:12:29.903Z",
    "chatId": "chatId_1",
    "role": "user",
    "content": "content_1",
    "completed": true
  }
];

// ASSISTANTTOOLCALLS MOCK DATA
export const assistantToolCalls = [
  {
    "id": "44vpkzdu-83ll-6j0l-p61p-9fd2fiuivkd",
    "createdAt": "2025-07-27T00:12:29.903Z",
    "updatedAt": "2025-07-27T00:12:29.903Z",
    "completedAt": "2025-07-27T00:12:29.903Z",
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
    "id": "7izx8zwd-2cah-ik4c-xn43-fzv963erkv6",
    "createdAt": "2025-07-27T00:12:29.903Z",
    "updatedAt": "2025-07-27T00:12:29.903Z",
    "name": "Personas 1",
    "description": "Description for personas 1",
    "systemPrompt": "systemPrompt_1",
    "temperature": 0.04,
    "defaultPersona": "defaultPersona_1",
    "color": "color_1",
    "icon": "icon_1",
    "modelId": "modelId_1",
    "reasoning": "low",
    "active": true
  }
];

// AGENTS MOCK DATA
export const agents = [
  {
    "id": "fjo7hqyg-2ee8-2s9p-i6n5-1uwebbchipg",
    "createdAt": "2025-07-27T00:12:29.903Z",
    "updatedAt": "2025-07-27T00:12:29.903Z",
    "name": "Math Tutor Agent",
    "description": "Helps students with mathematical concepts and problem-solving",
    "systemPrompt": "You are a helpful math tutor. Guide students through problems step by step.",
    "temperature": 0.26,
    "modelId": "modelId_1",
    "reasoning": "low"
  },
  {
    "id": "bytivzz9-aixn-c1gx-wl7b-eldbpre2vzj",
    "createdAt": "2025-07-27T00:12:29.903Z",
    "updatedAt": "2025-07-27T00:12:29.903Z",
    "name": "Science Helper Bot",
    "description": "Assists with scientific inquiries and experiments",
    "systemPrompt": "You are a science assistant. Help students understand scientific concepts.",
    "temperature": 0.69,
    "modelId": "modelId_2"
  }
];

// SIMULATIONATTEMPTS MOCK DATA
export const simulationAttempts = [
  {
    "id": "ipoedgxi-g7fb-jd03-x33v-2uq590rh5jk",
    "createdAt": "2025-07-27T00:12:29.903Z",
    "simulationId": "simulationId_1"
  }
];

// PARAMETERS MOCK DATA
export const parameters = [
  {
    "id": "s90sf0og-ntw4-dp39-jzxo-vvgf2vr5rwb",
    "createdAt": "2025-07-27T00:12:29.903Z",
    "updatedAt": "2025-07-27T00:12:29.903Z",
    "name": "Parameters 1",
    "description": "Description for parameters 1",
    "numerical": false,
    "active": true
  }
];

// PARAMETERITEMS MOCK DATA
export const parameterItems = [
  {
    "id": "gnzqlozy-t7ma-aff5-0jsy-ghwxzmwxzu8",
    "createdAt": "2025-07-27T00:12:29.903Z",
    "updatedAt": "2025-07-27T00:12:29.903Z",
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
    "id": "p5vu3yu8-5090-b6up-yacf-6n4v2d8fr2w",
    "createdAt": "2025-07-27T00:12:29.903Z",
    "updatedAt": "2025-07-27T00:12:29.903Z",
    "name": "Algebra Problem Solving",
    "description": "Students work through complex algebra problems with AI assistance",
    "parameterItemIds": [
      "parameterItemIds_1"
    ],
    "documentIds": [
      "documentIds_1"
    ],
    "defaultScenario": "defaultScenario_1",
    "practiceScenario": "practiceScenario_1",
    "generated": true,
    "active": true
  },
  {
    "id": "umbra5q1-y35g-jpql-v9go-z4rsvyhb9kp",
    "createdAt": "2025-07-27T00:12:29.903Z",
    "updatedAt": "2025-07-27T00:12:29.903Z",
    "name": "Chemistry Lab Safety",
    "description": "Students learn lab safety protocols through interactive scenarios",
    "parameterItemIds": [
      "parameterItemIds_2"
    ],
    "defaultScenario": "defaultScenario_2",
    "practiceScenario": "practiceScenario_2",
    "generated": true,
    "parentId": "parentId_2",
    "active": false
  }
];

// SIMULATIONCHATS MOCK DATA
export const simulationChats = [
  {
    "id": "n6kbs0yr-58oa-7ge0-m9uh-yf92xaqivng",
    "createdAt": "2025-07-27T00:12:29.903Z",
    "updatedAt": "2025-07-27T00:12:29.903Z",
    "completedAt": "2025-07-27T00:12:29.903Z",
    "title": "Simulation_chats 1",
    "scenarioId": "scenarioId_1",
    "attemptId": "attemptId_1",
    "completed": false,
    "traceId": "traceId_1"
  }
];

// SIMULATIONS MOCK DATA
export const simulations = [
  {
    "id": "1zyp7gyv-ny3y-wftz-p5vb-9kwmklhhjwo",
    "createdAt": "2025-07-27T00:12:29.903Z",
    "updatedAt": "2025-07-27T00:12:29.903Z",
    "title": "Math Practice Simulation",
    "timeLimit": "timeLimit_1",
    "active": true,
    "scenarioIds": [
      "p5vu3yu8-5090-b6up-yacf-6n4v2d8fr2w",
      "umbra5q1-y35g-jpql-v9go-z4rsvyhb9kp"
    ],
    "rubricId": "rubricId_1",
    "defaultSimulation": "defaultSimulation_1",
    "practiceSimulation": "practiceSimulation_1"
  },
  {
    "id": "ung32042-x24b-zuhh-sffb-j9s9vgtetht",
    "createdAt": "2025-07-27T00:12:29.903Z",
    "updatedAt": "2025-07-27T00:12:29.903Z",
    "title": "Lab Safety Training",
    "timeLimit": "timeLimit_2",
    "active": false,
    "scenarioIds": [
      "p5vu3yu8-5090-b6up-yacf-6n4v2d8fr2w",
      "umbra5q1-y35g-jpql-v9go-z4rsvyhb9kp"
    ],
    "rubricId": "rubricId_2",
    "defaultSimulation": "defaultSimulation_2",
    "practiceSimulation": "practiceSimulation_2"
  }
];

// SIMULATIONMESSAGES MOCK DATA
export const simulationMessages = [
  {
    "id": "n7w4scrj-rlyr-6y6c-qr67-o7caox5epak",
    "createdAt": "2025-07-27T00:12:29.903Z",
    "updatedAt": "2025-07-27T00:12:29.903Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query",
    "completed": true
  }
];

// SIMULATIONCHATGRADES MOCK DATA
export const simulationChatGrades = [
  {
    "id": "sgdniqan-x7em-uumb-fu0h-suk3yye7o6",
    "createdAt": "2025-07-27T00:12:29.903Z",
    "passed": false,
    "score": 26,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1",
    "simulationChatId": "simulationChatId_1"
  }
];

// SIMULATIONCHATFEEDBACKS MOCK DATA
export const simulationChatFeedbacks = [
  {
    "id": "z535ze97-60km-tmcq-gm5f-vn5jzl3l5p",
    "createdAt": "2025-07-27T00:12:29.903Z",
    "standardId": "standardId_1",
    "simulationChatGradeId": "simulationChatGradeId_1",
    "total": 100,
    "feedback": "feedback_1"
  }
];

// COHORTS MOCK DATA
export const cohorts = [
  {
    "id": "a0ek8nue-o8kz-vtlv-f9dj-iuwsl91o9o",
    "createdAt": "2025-07-27T00:12:29.903Z",
    "updatedAt": "2025-07-27T00:12:29.903Z",
    "title": "Fall 2024 Cohort",
    "active": true,
    "profileIds": [
      "3rzuo819-vu92-bt8u-jsrb-wpljz10qe1",
      "oei1jeix-f230-cubc-68gq-oldc539j08",
      "15rmsu47-iqfj-68ic-5kyy-6q95ql10r2d",
      "6cfjbyhz-gdls-uw9t-mxsz-n6uowe2tc0g"
    ],
    "defaultCohort": "defaultCohort_1",
    "simulationIds": [
      "1zyp7gyv-ny3y-wftz-p5vb-9kwmklhhjwo",
      "ung32042-x24b-zuhh-sffb-j9s9vgtetht"
    ]
  },
  {
    "id": "8dpt42a8-60x5-vzao-gpc3-cc1stygytoc",
    "createdAt": "2025-07-27T00:12:29.903Z",
    "updatedAt": "2025-07-27T00:12:29.903Z",
    "title": "Spring 2024 Advanced",
    "active": false,
    "profileIds": [
      "3rzuo819-vu92-bt8u-jsrb-wpljz10qe1",
      "oei1jeix-f230-cubc-68gq-oldc539j08",
      "15rmsu47-iqfj-68ic-5kyy-6q95ql10r2d",
      "6cfjbyhz-gdls-uw9t-mxsz-n6uowe2tc0g"
    ],
    "defaultCohort": "defaultCohort_2",
    "simulationIds": [
      "1zyp7gyv-ny3y-wftz-p5vb-9kwmklhhjwo",
      "ung32042-x24b-zuhh-sffb-j9s9vgtetht"
    ]
  }
];

// VERIFICATIONTOKEN MOCK DATA
export const verificationToken = [
  {
    "identifier": "identifier_1",
    "expires": "2025-07-27T00:12:29.903Z",
    "token": "token_1"
  }
];

