// Mock schema for the database, so we have mock data to work with
// Generated automatically by generate-mocks.js

// CLASSES MOCK DATA
export const classes = [
  {
    "id": "lsizbx40-6ip5-ycyl-8thd-9owyxishov9",
    "createdAt": "2025-07-15T12:57:53.511Z",
    "updatedAt": "2025-07-15T12:57:53.511Z",
    "name": "Algebra I",
    "classCode": "MATH101",
    "year": 2024,
    "term": "fall",
    "description": "Introduction to algebraic concepts and problem solving",
    "defaultClass": "defaultClass_1"
  },
  {
    "id": "o9d36rvu-7xpc-kvsg-rimj-n6asws7kmdg",
    "createdAt": "2025-07-15T12:57:53.511Z",
    "updatedAt": "2025-07-15T12:57:53.511Z",
    "name": "General Chemistry",
    "classCode": "CHEM101",
    "year": 2024,
    "term": "spring",
    "description": "Basic principles of chemistry and lab techniques",
    "defaultClass": "defaultClass_2"
  }
];

// TOPICS MOCK DATA
export const topics = [
  {
    "id": "683af3km-ob1j-ag35-ez3a-s0z2fdah1mb",
    "createdAt": "2025-07-15T12:57:53.511Z",
    "updatedAt": "2025-07-15T12:57:53.511Z",
    "name": "Topics 1",
    "description": "Description for topics 1",
    "prerequisite": false,
    "classId": "classId_1"
  }
];

// SCHEDULES MOCK DATA
export const schedules = [
  {
    "id": "n3odyw3a-k80g-lmma-1v2n-f7txkpeb4a",
    "createdAt": "2025-07-15T12:57:53.511Z",
    "updatedAt": "2025-07-15T12:57:53.511Z",
    "name": "Schedules 1",
    "description": "Description for schedules 1",
    "classId": "classId_1"
  }
];

// EVENTS MOCK DATA
export const events = [
  {
    "id": "b5fs8a8j-nd6r-5a9y-cjcp-ygnu7vfwul",
    "createdAt": "2025-07-15T12:57:53.511Z",
    "updatedAt": "2025-07-15T12:57:53.511Z",
    "name": "Events 1",
    "description": "Description for events 1",
    "time": "2025-07-15T12:57:53.511Z",
    "scheduleId": "scheduleId_1"
  }
];

// DOCUMENTS MOCK DATA
export const documents = [
  {
    "id": "l4tfnhte-dtvw-t2ti-r6pb-hxsqgvxlm8",
    "createdAt": "2025-07-15T12:57:53.511Z",
    "updatedAt": "2025-07-15T12:57:53.511Z",
    "name": "Documents 1",
    "filePath": "filePath_1",
    "mimeType": "mimeType_1",
    "classId": "classId_1",
    "type": "homework",
    "classified": true,
    "fileId": "fileId_1"
  }
];

// PROVIDERS MOCK DATA
export const providers = [
  {
    "id": "n2mo2ue2-ih6t-46up-85uj-ig9ii3nfvv",
    "createdAt": "2025-07-15T12:57:53.511Z",
    "updatedAt": "2025-07-15T12:57:53.511Z",
    "name": "Providers 1",
    "description": "Description for providers 1",
    "apiKey": "apiKey_1"
  }
];

// ACCOUNTS MOCK DATA
export const accounts = [
  {
    "id": 32,
    "userId": 95,
    "type": "type_1",
    "provider": "provider_1",
    "providerAccountId": "providerAccountId_1",
    "refreshToken": "refreshToken_1",
    "expiresAt": 33,
    "idToken": "idToken_1",
    "sessionState": "sessionState_1",
    "tokenType": "tokenType_1"
  }
];

// SESSIONS MOCK DATA
export const sessions = [
  {
    "id": 44,
    "userId": 62,
    "expires": "2025-07-15T12:57:53.511Z",
    "sessionToken": "sessionToken_1"
  }
];

// MODELS MOCK DATA
export const models = [
  {
    "id": "jq6b5qfs-y99u-q33b-hzhj-wfgtqtuwk0d",
    "createdAt": "2025-07-15T12:57:53.511Z",
    "updatedAt": "2025-07-15T12:57:53.511Z",
    "name": "Models 1",
    "description": "Description for models 1",
    "providerId": "providerId_1",
    "active": true
  }
];

// USERS MOCK DATA
export const users = [
  {
    "id": 85,
    "name": "Admin User",
    "email": "admin@example.com",
    "emailVerified": "2025-07-15T12:57:53.511Z",
    "image": "image_1"
  },
  {
    "id": 41,
    "email": "instructional@example.com",
    "image": "image_2"
  },
  {
    "id": 3,
    "name": "Instructor User",
    "emailVerified": "2025-07-15T12:57:53.511Z",
    "image": "image_3"
  },
  {
    "id": 74,
    "name": "TA User",
    "email": "ta@example.com",
    "image": "image_4"
  }
];

// PROFILES MOCK DATA
export const profiles = [
  {
    "id": "4tpgeohp-jfau-8d8q-6k5u-h82hgjiosf",
    "updatedAt": "2025-07-15T12:57:53.511Z",
    "userId": 85,
    "lastLogin": "2025-07-15T12:57:53.511Z",
    "firstName": "Admin",
    "lastName": "User",
    "alias": "admin-user",
    "viewedIntro": "viewedIntro_1",
    "createdAt": "2025-07-15T12:57:53.511Z",
    "role": "admin",
    "classIds": [
      "lsizbx40-6ip5-ycyl-8thd-9owyxishov9",
      "o9d36rvu-7xpc-kvsg-rimj-n6asws7kmdg"
    ],
    "active": true,
    "lastActive": "2025-07-15T12:57:53.511Z"
  },
  {
    "id": "1j1g951s-i9l3-j7va-84py-ip9u6n4618",
    "updatedAt": "2025-07-15T12:57:53.511Z",
    "userId": 41,
    "lastLogin": "2025-07-15T12:57:53.511Z",
    "firstName": "Instructional",
    "lastName": "User",
    "alias": "instructional-user",
    "viewedIntro": "viewedIntro_2",
    "createdAt": "2025-07-15T12:57:53.511Z",
    "role": "instructional",
    "classIds": [
      "lsizbx40-6ip5-ycyl-8thd-9owyxishov9",
      "o9d36rvu-7xpc-kvsg-rimj-n6asws7kmdg"
    ],
    "active": false,
    "lastActive": "2025-07-15T12:57:53.511Z"
  },
  {
    "id": "p7i9jqrq-q36e-9i3c-uvdq-qe6n50v8m7",
    "updatedAt": "2025-07-15T12:57:53.511Z",
    "userId": 3,
    "lastLogin": "2025-07-15T12:57:53.511Z",
    "firstName": "Instructor",
    "lastName": "User",
    "alias": "instructor-user",
    "viewedIntro": "viewedIntro_3",
    "createdAt": "2025-07-15T12:57:53.511Z",
    "role": "instructor",
    "classIds": [
      "lsizbx40-6ip5-ycyl-8thd-9owyxishov9",
      "o9d36rvu-7xpc-kvsg-rimj-n6asws7kmdg"
    ],
    "active": false,
    "lastActive": "2025-07-15T12:57:53.511Z"
  },
  {
    "id": "ya4wskxo-2xxz-2icu-smhz-cyatpk10k8e",
    "updatedAt": "2025-07-15T12:57:53.511Z",
    "lastLogin": "2025-07-15T12:57:53.511Z",
    "firstName": "TA",
    "lastName": "User",
    "alias": "ta-user",
    "viewedIntro": "viewedIntro_4",
    "createdAt": "2025-07-15T12:57:53.511Z",
    "role": "ta",
    "classIds": [
      "lsizbx40-6ip5-ycyl-8thd-9owyxishov9",
      "o9d36rvu-7xpc-kvsg-rimj-n6asws7kmdg"
    ],
    "active": false,
    "lastActive": "2025-07-15T12:57:53.511Z",
    "userId": 74
  }
];

// RUBRICS MOCK DATA
export const rubrics = [
  {
    "id": "54gtz85h-w82m-4wt9-7pnn-yuf4ssscsx",
    "createdAt": "2025-07-15T12:57:53.511Z",
    "updatedAt": "2025-07-15T12:57:53.511Z",
    "name": "Math Problem Solving Rubric",
    "description": "Evaluates mathematical reasoning and problem-solving skills",
    "points": 88,
    "passPoints": "passPoints_1",
    "defaultRubric": "defaultRubric_1"
  },
  {
    "id": "8xsymemp-5a7s-zwtr-epcd-mcilsisrsbl",
    "createdAt": "2025-07-15T12:57:53.511Z",
    "updatedAt": "2025-07-15T12:57:53.511Z",
    "name": "Science Lab Rubric",
    "description": "Assesses lab technique and safety knowledge",
    "points": 73,
    "passPoints": "passPoints_2",
    "defaultRubric": "defaultRubric_2"
  }
];

// STANDARDGROUPS MOCK DATA
export const standardGroups = [
  {
    "id": "utmjroz7-rwun-4d58-l8ri-wxp7ncj9wd",
    "createdAt": "2025-07-15T12:57:53.511Z",
    "name": "Standard_groups 1",
    "shortName": "shortName_1",
    "description": "Description for standard_groups 1",
    "points": 67,
    "passPoints": "passPoints_1",
    "rubricId": "rubricId_1"
  }
];

// STANDARDS MOCK DATA
export const standards = [
  {
    "id": "x7efvxli-ii9e-whn4-qsc8-dv1ox1ot3b",
    "createdAt": "2025-07-15T12:57:53.511Z",
    "name": "Standards 1",
    "description": "Description for standards 1",
    "points": 3,
    "standardGroupId": "standardGroupId_1"
  }
];

// APPLOGS MOCK DATA
export const appLogs = [
  {
    "id": 6,
    "level": "level_1",
    "message": "message_1",
    "context": {},
    "createdAt": "2025-07-15T12:57:53.511Z"
  }
];

// APPFEEDBACK MOCK DATA
export const appFeedback = [
  {
    "id": 65,
    "createdAt": "2025-07-15T12:57:53.511Z",
    "profileId": "profileId_1",
    "type": "feature",
    "message": "message_1"
  }
];

// ASSISTANTCHATS MOCK DATA
export const assistantChats = [
  {
    "id": "6om1d1p4-izrv-s3lw-93a6-inu2fyucj8m",
    "createdAt": "2025-07-15T12:57:53.511Z",
    "updatedAt": "2025-07-15T12:57:53.511Z",
    "title": "Assistant_chats 1",
    "profileId": "profileId_1"
  }
];

// SCENARIOS MOCK DATA
export const scenarios = [
  {
    "id": "1xe6vfql-2nxd-wj8z-iny9-ilmfdyq3pfs",
    "createdAt": "2025-07-15T12:57:53.511Z",
    "updatedAt": "2025-07-15T12:57:53.511Z",
    "name": "Algebra Problem Solving",
    "description": "Students work through complex algebra problems with AI assistance",
    "classId": "classId_1",
    "crowdedness": 28,
    "intensity": 86,
    "seniority": "freshman",
    "tod": "9AM",
    "defaultScenario": "defaultScenario_1",
    "generated": true
  },
  {
    "id": "2suxo4j3-d11u-ye80-slk8-rhx972zntp8",
    "createdAt": "2025-07-15T12:57:53.511Z",
    "updatedAt": "2025-07-15T12:57:53.511Z",
    "name": "Chemistry Lab Safety",
    "description": "Students learn lab safety protocols through interactive scenarios",
    "agentId": "agentId_2",
    "classId": "classId_2",
    "crowdedness": 54,
    "intensity": 28,
    "seniority": "sophomore",
    "defaultScenario": "defaultScenario_2",
    "generated": true
  }
];

// ASSISTANTMESSAGES MOCK DATA
export const assistantMessages = [
  {
    "id": "2zoj2pyx-350h-bqr1-xwqf-imbk22mr3z",
    "createdAt": "2025-07-15T12:57:53.511Z",
    "updatedAt": "2025-07-15T12:57:53.511Z",
    "completedAt": "2025-07-15T12:57:53.511Z",
    "chatId": "chatId_1",
    "role": "user",
    "content": "content_1",
    "completed": false
  }
];

// ASSISTANTTOOLCALLS MOCK DATA
export const assistantToolCalls = [
  {
    "id": "nff4s4se-uavt-51v1-ckgq-dwn10npmjz",
    "createdAt": "2025-07-15T12:57:53.511Z",
    "updatedAt": "2025-07-15T12:57:53.511Z",
    "completedAt": "2025-07-15T12:57:53.511Z",
    "chatId": "chatId_1",
    "toolName": "toolName_1",
    "toolType": "toolType_1",
    "toolArguments": "toolArguments_1",
    "toolResult": "toolResult_1",
    "completed": false
  }
];

// COMPONENTS MOCK DATA
export const components = [
  {
    "id": "3t1eze5u-8txl-kub8-x62b-0q1p645irsmk",
    "createdAt": "2025-07-15T12:57:53.511Z",
    "updatedAt": "2025-07-15T12:57:53.511Z",
    "name": "Components 1",
    "description": "Description for components 1",
    "fileName": "fileName_1",
    "layout": {},
    "stat": false,
    "defaultComponent": "defaultComponent_1"
  }
];

// AGENTS MOCK DATA
export const agents = [
  {
    "id": "s2g4qddu-vuy5-5zdw-0lkb-036d2vfzpokp",
    "createdAt": "2025-07-15T12:57:53.511Z",
    "updatedAt": "2025-07-15T12:57:53.511Z",
    "name": "Math Tutor Agent",
    "description": "Helps students with mathematical concepts and problem-solving",
    "systemPrompt": "You are a helpful math tutor. Guide students through problems step by step.",
    "temperature": 0.86,
    "defaultAgent": "defaultAgent_1",
    "editable": true,
    "modelId": "modelId_1"
  },
  {
    "id": "83ye7s7c-ni4u-c3tv-oroh-yng48qbsvtp",
    "createdAt": "2025-07-15T12:57:53.511Z",
    "updatedAt": "2025-07-15T12:57:53.511Z",
    "name": "Science Helper Bot",
    "description": "Assists with scientific inquiries and experiments",
    "systemPrompt": "You are a science assistant. Help students understand scientific concepts.",
    "temperature": 0.44,
    "defaultAgent": "defaultAgent_2",
    "editable": true,
    "modelId": "modelId_2",
    "reasoning": "medium"
  }
];

// DASHBOARDS MOCK DATA
export const dashboards = [
  {
    "id": "prufdm39-gs0a-hvxw-0qye-x62zqlut28",
    "createdAt": "2025-07-15T12:57:53.511Z",
    "updatedAt": "2025-07-15T12:57:53.511Z",
    "headerComponentIds": [
      "headerComponentIds_1"
    ],
    "primaryComponentIds": [
      "primaryComponentIds_1"
    ],
    "secondaryComponentIds": [
      "secondaryComponentIds_1"
    ],
    "footerComponentIds": [
      "footerComponentIds_1"
    ],
    "autoScroll": "autoScroll_1",
    "showIndicators": "showIndicators_1",
    "headerComponents": "headerComponents_1",
    "mainSplit": "mainSplit_1",
    "footerSplit": "footerSplit_1"
  }
];

// COHORTS MOCK DATA
export const cohorts = [
  {
    "id": "xgoovv39-n3a3-kkc6-2yp0-hsr2eerzhks",
    "createdAt": "2025-07-15T12:57:53.511Z",
    "updatedAt": "2025-07-15T12:57:53.511Z",
    "title": "Fall 2024 Cohort",
    "description": "Students enrolled in fall semester courses",
    "active": true,
    "profileIds": [
      "4tpgeohp-jfau-8d8q-6k5u-h82hgjiosf",
      "1j1g951s-i9l3-j7va-84py-ip9u6n4618",
      "p7i9jqrq-q36e-9i3c-uvdq-qe6n50v8m7",
      "ya4wskxo-2xxz-2icu-smhz-cyatpk10k8e"
    ],
    "defaultCohort": "defaultCohort_1"
  },
  {
    "id": "gs3pr26o-ikzf-nnur-xg0h-5tnkccs5rt",
    "createdAt": "2025-07-15T12:57:53.511Z",
    "updatedAt": "2025-07-15T12:57:53.511Z",
    "title": "Spring 2024 Advanced",
    "description": "Advanced students in spring programs",
    "active": false,
    "profileIds": [
      "4tpgeohp-jfau-8d8q-6k5u-h82hgjiosf",
      "1j1g951s-i9l3-j7va-84py-ip9u6n4618",
      "p7i9jqrq-q36e-9i3c-uvdq-qe6n50v8m7",
      "ya4wskxo-2xxz-2icu-smhz-cyatpk10k8e"
    ],
    "defaultCohort": "defaultCohort_2"
  }
];

// SIMULATIONS MOCK DATA
export const simulations = [
  {
    "id": "5kkbu48f-swfh-ultu-4imn-6xba6nylygm",
    "createdAt": "2025-07-15T12:57:53.511Z",
    "updatedAt": "2025-07-15T12:57:53.511Z",
    "title": "Math Practice Simulation",
    "timeLimit": "timeLimit_1",
    "active": true,
    "scenarioIds": [
      "1xe6vfql-2nxd-wj8z-iny9-ilmfdyq3pfs",
      "2suxo4j3-d11u-ye80-slk8-rhx972zntp8"
    ],
    "cohortIds": [
      "xgoovv39-n3a3-kkc6-2yp0-hsr2eerzhks",
      "gs3pr26o-ikzf-nnur-xg0h-5tnkccs5rt"
    ],
    "rubricId": "rubricId_1",
    "defaultSimulation": "defaultSimulation_1"
  },
  {
    "id": "6mw70ako-w3iv-1j8y-8w4w-kzpmrrfa1t",
    "createdAt": "2025-07-15T12:57:53.511Z",
    "updatedAt": "2025-07-15T12:57:53.511Z",
    "title": "Lab Safety Training",
    "active": false,
    "scenarioIds": [
      "1xe6vfql-2nxd-wj8z-iny9-ilmfdyq3pfs",
      "2suxo4j3-d11u-ye80-slk8-rhx972zntp8"
    ],
    "cohortIds": [
      "xgoovv39-n3a3-kkc6-2yp0-hsr2eerzhks",
      "gs3pr26o-ikzf-nnur-xg0h-5tnkccs5rt"
    ],
    "rubricId": "rubricId_2",
    "defaultSimulation": "defaultSimulation_2"
  }
];

// SIMULATIONATTEMPTS MOCK DATA
export const simulationAttempts = [
  {
    "id": "q3ml8fcf-wref-9fon-iin9-bftihdmcnle",
    "createdAt": "2025-07-15T12:57:53.511Z",
    "profileId": "profileId_1",
    "simulationId": "simulationId_1"
  }
];

// SIMULATIONCHATS MOCK DATA
export const simulationChats = [
  {
    "id": "hq7sr28z-xgy4-pyop-uurb-jdxs6gbxlb",
    "createdAt": "2025-07-15T12:57:53.511Z",
    "updatedAt": "2025-07-15T12:57:53.511Z",
    "completedAt": "2025-07-15T12:57:53.511Z",
    "title": "Simulation_chats 1",
    "scenarioId": "scenarioId_1",
    "attemptId": "attemptId_1",
    "completed": true,
    "traceId": "traceId_1"
  }
];

// SIMULATIONMESSAGES MOCK DATA
export const simulationMessages = [
  {
    "id": "cpdblbx7-yvxa-8uyu-bj2e-yky2utdtwmg",
    "createdAt": "2025-07-15T12:57:53.511Z",
    "updatedAt": "2025-07-15T12:57:53.511Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query",
    "completed": false
  }
];

// SIMULATIONCHATGRADES MOCK DATA
export const simulationChatGrades = [
  {
    "id": "6bow0f4s-gna6-jbhp-g76m-h2097pesdsf",
    "createdAt": "2025-07-15T12:57:53.511Z",
    "passed": false,
    "score": 71,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1",
    "simulationChatId": "simulationChatId_1"
  }
];

// SIMULATIONCHATFEEDBACKS MOCK DATA
export const simulationChatFeedbacks = [
  {
    "id": "yxkama7j-qj9f-8q91-5yug-wyvk38ax1f",
    "createdAt": "2025-07-15T12:57:53.511Z",
    "standardId": "standardId_1",
    "simulationChatGradeId": "simulationChatGradeId_1",
    "total": 45,
    "feedback": "feedback_1"
  }
];

// VERIFICATIONTOKEN MOCK DATA
export const verificationToken = [
  {
    "identifier": "identifier_1",
    "expires": "2025-07-15T12:57:53.511Z",
    "token": "token_1"
  }
];

