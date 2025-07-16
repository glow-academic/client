// Mock schema for the database, so we have mock data to work with
// Generated automatically by generate-mocks.js

// CLASSES MOCK DATA
export const classes = [
  {
    "id": "l2hhj04t-8y5h-f047-03gi-5pk6bpu8bap",
    "createdAt": "2025-07-16T18:08:12.510Z",
    "updatedAt": "2025-07-16T18:08:12.510Z",
    "name": "Algebra I",
    "classCode": "MATH101",
    "year": 2024,
    "term": "fall",
    "description": "Introduction to algebraic concepts and problem solving",
    "defaultClass": "defaultClass_1"
  },
  {
    "id": "re0wa89o-ruky-4gz0-j6hk-ev8pz6lkjmd",
    "createdAt": "2025-07-16T18:08:12.510Z",
    "updatedAt": "2025-07-16T18:08:12.510Z",
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
    "id": "4dk6wroo-fyzf-awrm-9q62-hsruxgv22y",
    "createdAt": "2025-07-16T18:08:12.510Z",
    "updatedAt": "2025-07-16T18:08:12.510Z",
    "name": "Topics 1",
    "description": "Description for topics 1",
    "prerequisite": false,
    "classId": "classId_1"
  }
];

// SCHEDULES MOCK DATA
export const schedules = [
  {
    "id": "e3xrxots-ghpg-whnk-iihn-9kknhyccjx9",
    "createdAt": "2025-07-16T18:08:12.510Z",
    "updatedAt": "2025-07-16T18:08:12.510Z",
    "name": "Schedules 1",
    "description": "Description for schedules 1",
    "classId": "classId_1"
  }
];

// EVENTS MOCK DATA
export const events = [
  {
    "id": "83sgbeiz-tr6d-vbi0-ftg1-xcpnd9n442h",
    "createdAt": "2025-07-16T18:08:12.510Z",
    "updatedAt": "2025-07-16T18:08:12.510Z",
    "name": "Events 1",
    "description": "Description for events 1",
    "documentType": "documentType_1",
    "time": "2025-07-16T18:08:12.510Z",
    "scheduleId": "scheduleId_1"
  }
];

// DOCUMENTS MOCK DATA
export const documents = [
  {
    "id": "57ru07cz-p9cu-yi1z-mjqd-nk9f48fn91c",
    "createdAt": "2025-07-16T18:08:12.510Z",
    "updatedAt": "2025-07-16T18:08:12.510Z",
    "name": "Documents 1",
    "filePath": "filePath_1",
    "mimeType": "mimeType_1",
    "classId": "classId_1",
    "type": "homework",
    "classified": false,
    "fileId": "fileId_1"
  }
];

// PROVIDERS MOCK DATA
export const providers = [
  {
    "id": "mzsy61cu-uzyg-fcck-290z-zurp2279hos",
    "createdAt": "2025-07-16T18:08:12.510Z",
    "updatedAt": "2025-07-16T18:08:12.510Z",
    "name": "Providers 1",
    "description": "Description for providers 1",
    "apiKey": "apiKey_1"
  }
];

// ACCOUNTS MOCK DATA
export const accounts = [
  {
    "id": 5,
    "userId": 78,
    "type": "type_1",
    "provider": "provider_1",
    "providerAccountId": "providerAccountId_1",
    "accessToken": "accessToken_1",
    "mode": "mode_1",
    "expiresAt": 100,
    "scope": "scope_1",
    "sessionState": "sessionState_1",
    "tokenType": "tokenType_1"
  }
];

// SESSIONS MOCK DATA
export const sessions = [
  {
    "id": 25,
    "userId": 65,
    "expires": "2025-07-16T18:08:12.510Z",
    "sessionToken": "sessionToken_1"
  }
];

// MODELS MOCK DATA
export const models = [
  {
    "id": "e6mxlz83-lmwe-7l7n-0med-owh0asdun8",
    "createdAt": "2025-07-16T18:08:12.510Z",
    "updatedAt": "2025-07-16T18:08:12.510Z",
    "name": "Models 1",
    "description": "Description for models 1",
    "providerId": "providerId_1",
    "active": true
  }
];

// USERS MOCK DATA
export const users = [
  {
    "id": 93,
    "name": "Admin User",
    "emailVerified": "2025-07-16T18:08:12.510Z",
    "image": "image_1"
  },
  {
    "id": 33,
    "name": "Instructional User",
    "email": "instructional@example.com",
    "emailVerified": "2025-07-16T18:08:12.510Z",
    "image": "image_2"
  },
  {
    "id": 34,
    "name": "Instructor User",
    "email": "instructor@example.com"
  },
  {
    "id": 75,
    "name": "TA User",
    "emailVerified": "2025-07-16T18:08:12.510Z",
    "image": "image_4"
  }
];

// PROFILES MOCK DATA
export const profiles = [
  {
    "id": "ecsb7mvy-wm2d-owso-9pwu-fx9fgghj8t",
    "updatedAt": "2025-07-16T18:08:12.510Z",
    "userId": 93,
    "lastLogin": "2025-07-16T18:08:12.510Z",
    "firstName": "Admin",
    "lastName": "User",
    "alias": "admin-user",
    "viewedIntro": "viewedIntro_1",
    "createdAt": "2025-07-16T18:08:12.510Z",
    "role": "admin",
    "classIds": [
      "l2hhj04t-8y5h-f047-03gi-5pk6bpu8bap",
      "re0wa89o-ruky-4gz0-j6hk-ev8pz6lkjmd"
    ],
    "active": true,
    "lastActive": "2025-07-16T18:08:12.510Z"
  },
  {
    "id": "d6l64cjg-g1zy-yfeo-ht1k-rerifrnlx5o",
    "updatedAt": "2025-07-16T18:08:12.510Z",
    "userId": 33,
    "lastLogin": "2025-07-16T18:08:12.510Z",
    "firstName": "Instructional",
    "lastName": "User",
    "alias": "instructional-user",
    "viewedIntro": "viewedIntro_2",
    "createdAt": "2025-07-16T18:08:12.510Z",
    "role": "instructional",
    "classIds": [
      "l2hhj04t-8y5h-f047-03gi-5pk6bpu8bap",
      "re0wa89o-ruky-4gz0-j6hk-ev8pz6lkjmd"
    ],
    "active": false,
    "lastActive": "2025-07-16T18:08:12.510Z"
  },
  {
    "id": "9p1gsrei-xjak-b4yg-przc-4srubglz9n9",
    "updatedAt": "2025-07-16T18:08:12.510Z",
    "userId": 34,
    "lastLogin": "2025-07-16T18:08:12.510Z",
    "firstName": "Instructor",
    "lastName": "User",
    "alias": "instructor-user",
    "viewedIntro": "viewedIntro_3",
    "createdAt": "2025-07-16T18:08:12.510Z",
    "role": "instructor",
    "classIds": [
      "l2hhj04t-8y5h-f047-03gi-5pk6bpu8bap",
      "re0wa89o-ruky-4gz0-j6hk-ev8pz6lkjmd"
    ],
    "active": false,
    "lastActive": "2025-07-16T18:08:12.510Z"
  },
  {
    "id": "noxnot19-a7jo-sq73-ipv7-uohs6obe9",
    "updatedAt": "2025-07-16T18:08:12.510Z",
    "userId": 75,
    "lastLogin": "2025-07-16T18:08:12.510Z",
    "firstName": "TA",
    "lastName": "User",
    "alias": "ta-user",
    "viewedIntro": "viewedIntro_4",
    "createdAt": "2025-07-16T18:08:12.510Z",
    "role": "ta",
    "classIds": [
      "l2hhj04t-8y5h-f047-03gi-5pk6bpu8bap",
      "re0wa89o-ruky-4gz0-j6hk-ev8pz6lkjmd"
    ],
    "active": false,
    "lastActive": "2025-07-16T18:08:12.510Z"
  }
];

// RUBRICS MOCK DATA
export const rubrics = [
  {
    "id": "y26h5qzw-608x-17h1-7plu-l0zhubdfdwe",
    "createdAt": "2025-07-16T18:08:12.510Z",
    "updatedAt": "2025-07-16T18:08:12.510Z",
    "name": "Math Problem Solving Rubric",
    "description": "Evaluates mathematical reasoning and problem-solving skills",
    "points": 83,
    "passPoints": "passPoints_1",
    "defaultRubric": "defaultRubric_1"
  },
  {
    "id": "r9boxhse-5p01-lmff-xnf5-j9ahlotav6n",
    "createdAt": "2025-07-16T18:08:12.510Z",
    "updatedAt": "2025-07-16T18:08:12.510Z",
    "name": "Science Lab Rubric",
    "description": "Assesses lab technique and safety knowledge",
    "points": 30,
    "passPoints": "passPoints_2",
    "defaultRubric": "defaultRubric_2"
  }
];

// STANDARDGROUPS MOCK DATA
export const standardGroups = [
  {
    "id": "o5okbjsp-txss-ob0v-wfg5-bsjqzt854x7",
    "createdAt": "2025-07-16T18:08:12.510Z",
    "name": "Standard_groups 1",
    "shortName": "shortName_1",
    "description": "Description for standard_groups 1",
    "points": 48,
    "passPoints": "passPoints_1",
    "rubricId": "rubricId_1"
  }
];

// STANDARDS MOCK DATA
export const standards = [
  {
    "id": "cy1wc0sw-dsig-21gj-ib8m-y192hfybhr",
    "createdAt": "2025-07-16T18:08:12.510Z",
    "name": "Standards 1",
    "description": "Description for standards 1",
    "points": 5,
    "standardGroupId": "standardGroupId_1"
  }
];

// APPLOGS MOCK DATA
export const appLogs = [
  {
    "id": 31,
    "level": "level_1",
    "message": "message_1",
    "context": {},
    "createdAt": "2025-07-16T18:08:12.510Z"
  }
];

// APPFEEDBACK MOCK DATA
export const appFeedback = [
  {
    "id": 33,
    "createdAt": "2025-07-16T18:08:12.510Z",
    "profileId": "profileId_1",
    "type": "feature",
    "message": "message_1"
  }
];

// ASSISTANTCHATS MOCK DATA
export const assistantChats = [
  {
    "id": "mw0t5irl-cs7e-ai7g-28rw-lp2ihi362m7",
    "createdAt": "2025-07-16T18:08:12.510Z",
    "updatedAt": "2025-07-16T18:08:12.510Z",
    "title": "Assistant_chats 1",
    "profileId": "profileId_1"
  }
];

// SCENARIOS MOCK DATA
export const scenarios = [
  {
    "id": "b6yjulbq-r00d-ce1j-q4fr-zt1pntzwr9n",
    "createdAt": "2025-07-16T18:08:12.510Z",
    "updatedAt": "2025-07-16T18:08:12.510Z",
    "name": "Algebra Problem Solving",
    "description": "Students work through complex algebra problems with AI assistance",
    "agentId": "agentId_1",
    "crowdedness": 65,
    "intensity": 46,
    "location": "lawson",
    "tod": "9AM",
    "urgency": "hour",
    "defaultScenario": "defaultScenario_1",
    "practiceScenario": "practiceScenario_1",
    "generated": true
  },
  {
    "id": "rlfn5vfq-pva3-wl46-tg38-j6idhk0tr9l",
    "createdAt": "2025-07-16T18:08:12.510Z",
    "updatedAt": "2025-07-16T18:08:12.510Z",
    "name": "Chemistry Lab Safety",
    "description": "Students learn lab safety protocols through interactive scenarios",
    "agentId": "agentId_2",
    "classId": "classId_2",
    "seniority": "sophomore",
    "tod": "10AM",
    "defaultScenario": "defaultScenario_2",
    "practiceScenario": "practiceScenario_2",
    "generated": true
  }
];

// ASSISTANTMESSAGES MOCK DATA
export const assistantMessages = [
  {
    "id": "jrmhz1t5-n6if-dbth-ecsi-4vt7t4zvc9t",
    "createdAt": "2025-07-16T18:08:12.510Z",
    "updatedAt": "2025-07-16T18:08:12.510Z",
    "completedAt": "2025-07-16T18:08:12.510Z",
    "chatId": "chatId_1",
    "role": "user",
    "content": "content_1",
    "completed": false
  }
];

// ASSISTANTTOOLCALLS MOCK DATA
export const assistantToolCalls = [
  {
    "id": "eq0j783v-bvbg-kqvj-mbnf-l9uadf25ou",
    "createdAt": "2025-07-16T18:08:12.510Z",
    "updatedAt": "2025-07-16T18:08:12.510Z",
    "completedAt": "2025-07-16T18:08:12.510Z",
    "chatId": "chatId_1",
    "toolName": "toolName_1",
    "toolType": "toolType_1",
    "toolArguments": "toolArguments_1",
    "toolResult": "toolResult_1",
    "completed": true
  }
];

// COMPONENTS MOCK DATA
export const components = [
  {
    "id": "70mh5w41-2073-ho88-fwgx-h6itszmqlzf",
    "createdAt": "2025-07-16T18:08:12.510Z",
    "updatedAt": "2025-07-16T18:08:12.510Z",
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
    "id": "1t3otcgy-5q60-vv4e-62kx-vzs7x0zvmdp",
    "createdAt": "2025-07-16T18:08:12.510Z",
    "updatedAt": "2025-07-16T18:08:12.510Z",
    "name": "Math Tutor Agent",
    "description": "Helps students with mathematical concepts and problem-solving",
    "systemPrompt": "You are a helpful math tutor. Guide students through problems step by step.",
    "temperature": 0.9,
    "defaultAgent": "defaultAgent_1",
    "editable": true,
    "modelId": "modelId_1",
    "reasoning": "low"
  },
  {
    "id": "yxdewkv4-xdla-i1nd-e84u-a2zqq2gn8k9",
    "createdAt": "2025-07-16T18:08:12.510Z",
    "updatedAt": "2025-07-16T18:08:12.510Z",
    "name": "Science Helper Bot",
    "description": "Assists with scientific inquiries and experiments",
    "systemPrompt": "You are a science assistant. Help students understand scientific concepts.",
    "temperature": 0.01,
    "defaultAgent": "defaultAgent_2",
    "editable": true,
    "modelId": "modelId_2",
    "reasoning": "medium"
  }
];

// DASHBOARDS MOCK DATA
export const dashboards = [
  {
    "id": "ewbasvsi-j76y-664o-32n4-l98734ytigr",
    "createdAt": "2025-07-16T18:08:12.510Z",
    "updatedAt": "2025-07-16T18:08:12.510Z",
    "profileId": "profileId_1",
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
    "id": "6idzsfjy-rrw5-n43r-km8p-o381rnvwwz",
    "createdAt": "2025-07-16T18:08:12.510Z",
    "updatedAt": "2025-07-16T18:08:12.510Z",
    "title": "Fall 2024 Cohort",
    "active": true,
    "profileIds": [
      "ecsb7mvy-wm2d-owso-9pwu-fx9fgghj8t",
      "d6l64cjg-g1zy-yfeo-ht1k-rerifrnlx5o",
      "9p1gsrei-xjak-b4yg-przc-4srubglz9n9",
      "noxnot19-a7jo-sq73-ipv7-uohs6obe9"
    ],
    "defaultCohort": "defaultCohort_1"
  },
  {
    "id": "rjubpnni-76v9-5vpg-4wrw-w3vwdmm6za",
    "createdAt": "2025-07-16T18:08:12.510Z",
    "updatedAt": "2025-07-16T18:08:12.510Z",
    "title": "Spring 2024 Advanced",
    "active": false,
    "profileIds": [
      "ecsb7mvy-wm2d-owso-9pwu-fx9fgghj8t",
      "d6l64cjg-g1zy-yfeo-ht1k-rerifrnlx5o",
      "9p1gsrei-xjak-b4yg-przc-4srubglz9n9",
      "noxnot19-a7jo-sq73-ipv7-uohs6obe9"
    ],
    "defaultCohort": "defaultCohort_2"
  }
];

// SIMULATIONS MOCK DATA
export const simulations = [
  {
    "id": "jaan6z7m-e4k4-5hoj-3wec-1cgho9ln1n7",
    "createdAt": "2025-07-16T18:08:12.510Z",
    "updatedAt": "2025-07-16T18:08:12.510Z",
    "title": "Math Practice Simulation",
    "timeLimit": "timeLimit_1",
    "active": true,
    "scenarioIds": [
      "b6yjulbq-r00d-ce1j-q4fr-zt1pntzwr9n",
      "rlfn5vfq-pva3-wl46-tg38-j6idhk0tr9l"
    ],
    "cohortIds": [
      "6idzsfjy-rrw5-n43r-km8p-o381rnvwwz",
      "rjubpnni-76v9-5vpg-4wrw-w3vwdmm6za"
    ],
    "rubricId": "rubricId_1",
    "defaultSimulation": "defaultSimulation_1"
  },
  {
    "id": "5fkpylda-i5da-zg0w-dv5y-zu05wtb9gh",
    "createdAt": "2025-07-16T18:08:12.510Z",
    "updatedAt": "2025-07-16T18:08:12.510Z",
    "title": "Lab Safety Training",
    "timeLimit": "timeLimit_2",
    "active": false,
    "scenarioIds": [
      "b6yjulbq-r00d-ce1j-q4fr-zt1pntzwr9n",
      "rlfn5vfq-pva3-wl46-tg38-j6idhk0tr9l"
    ],
    "cohortIds": [
      "6idzsfjy-rrw5-n43r-km8p-o381rnvwwz",
      "rjubpnni-76v9-5vpg-4wrw-w3vwdmm6za"
    ],
    "rubricId": "rubricId_2",
    "defaultSimulation": "defaultSimulation_2"
  }
];

// SIMULATIONATTEMPTS MOCK DATA
export const simulationAttempts = [
  {
    "id": "yzz76c9l-9v1w-fp3r-tg6o-thoos78kmx8",
    "createdAt": "2025-07-16T18:08:12.510Z",
    "profileId": "profileId_1",
    "simulationId": "simulationId_1"
  }
];

// SIMULATIONCHATS MOCK DATA
export const simulationChats = [
  {
    "id": "ca9wx3l3-dera-lmmy-s3od-vgz5el4qer",
    "createdAt": "2025-07-16T18:08:12.510Z",
    "updatedAt": "2025-07-16T18:08:12.510Z",
    "completedAt": "2025-07-16T18:08:12.510Z",
    "title": "Simulation_chats 1",
    "scenarioId": "scenarioId_1",
    "attemptId": "attemptId_1",
    "completed": false
  }
];

// SIMULATIONMESSAGES MOCK DATA
export const simulationMessages = [
  {
    "id": "u4gv86t9-7xmm-m9x7-cyeo-zfcogotn4m",
    "createdAt": "2025-07-16T18:08:12.510Z",
    "updatedAt": "2025-07-16T18:08:12.510Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query",
    "completed": false
  }
];

// SIMULATIONCHATGRADES MOCK DATA
export const simulationChatGrades = [
  {
    "id": "q44bdm76-k9nk-7klz-6f0k-s32lhk27h1i",
    "createdAt": "2025-07-16T18:08:12.510Z",
    "passed": true,
    "score": 15,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1",
    "simulationChatId": "simulationChatId_1"
  }
];

// SIMULATIONCHATFEEDBACKS MOCK DATA
export const simulationChatFeedbacks = [
  {
    "id": "u47mhwur-vcn2-jttz-rnpy-hjyolmgt71o",
    "createdAt": "2025-07-16T18:08:12.510Z",
    "standardId": "standardId_1",
    "simulationChatGradeId": "simulationChatGradeId_1",
    "total": 29,
    "feedback": "feedback_1"
  }
];

// VERIFICATIONTOKEN MOCK DATA
export const verificationToken = [
  {
    "identifier": "identifier_1",
    "expires": "2025-07-16T18:08:12.510Z",
    "token": "token_1"
  }
];

