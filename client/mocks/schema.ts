// Mock schema for the database, so we have mock data to work with
// Generated automatically by generate-mocks.js

// CLASSES MOCK DATA
export const classes = [
  {
    "id": "xgx4on74-ep7i-else-4l2x-shtpsem3jcf",
    "createdAt": "2025-06-24T16:41:18.784Z",
    "updatedAt": "2025-06-24T16:41:18.784Z",
    "name": "Algebra I",
    "classCode": "MATH101",
    "year": 2024,
    "term": "fall",
    "description": "Introduction to algebraic concepts and problem solving",
    "defaultClass": "defaultClass_1"
  },
  {
    "id": "7wfpxljs-ft0j-qvjz-g6to-wf71r8jumf",
    "createdAt": "2025-06-24T16:41:18.784Z",
    "updatedAt": "2025-06-24T16:41:18.784Z",
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
    "id": "75nijsem-m79g-mp9a-yk7q-pbnmyx1in2b",
    "createdAt": "2025-06-24T16:41:18.784Z",
    "updatedAt": "2025-06-24T16:41:18.784Z",
    "name": "Topics 1",
    "description": "Description for topics 1",
    "prerequisite": true,
    "classId": "classId_1"
  }
];

// SCHEDULES MOCK DATA
export const schedules = [
  {
    "id": "u418czbp-y828-zeuc-d05m-8b2yarnpwxn",
    "createdAt": "2025-06-24T16:41:18.784Z",
    "updatedAt": "2025-06-24T16:41:18.784Z",
    "name": "Schedules 1",
    "description": "Description for schedules 1",
    "classId": "classId_1"
  }
];

// EVENTS MOCK DATA
export const events = [
  {
    "id": "u60v7ls6-8jgj-1olf-vf3x-s0zg9z9z5t",
    "createdAt": "2025-06-24T16:41:18.784Z",
    "updatedAt": "2025-06-24T16:41:18.784Z",
    "name": "Events 1",
    "description": "Description for events 1",
    "time": "2025-06-24T16:41:18.784Z",
    "scheduleId": "scheduleId_1"
  }
];

// DOCUMENTS MOCK DATA
export const documents = [
  {
    "id": "sl2ue2ay-84i0-ytxz-pxr1-x3n1zeavy8",
    "createdAt": "2025-06-24T16:41:18.784Z",
    "updatedAt": "2025-06-24T16:41:18.784Z",
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
    "id": "dekqhec6-rjun-6m4n-z0oj-vjh4ll1tstl",
    "createdAt": "2025-06-24T16:41:18.784Z",
    "updatedAt": "2025-06-24T16:41:18.784Z",
    "name": "Providers 1",
    "description": "Description for providers 1",
    "apiKey": "apiKey_1"
  }
];

// ACCOUNTS MOCK DATA
export const accounts = [
  {
    "id": 5,
    "userId": 37,
    "type": "type_1",
    "provider": "provider_1",
    "providerAccountId": "providerAccountId_1",
    "accessToken": "accessToken_1",
    "mode": "mode_1",
    "scope": "scope_1"
  }
];

// SESSIONS MOCK DATA
export const sessions = [
  {
    "id": 90,
    "userId": 16,
    "expires": "2025-06-24T16:41:18.784Z",
    "sessionToken": "sessionToken_1"
  }
];

// MODELS MOCK DATA
export const models = [
  {
    "id": "d2iphn4q-dn6l-y92i-n55l-v4gobjy439b",
    "createdAt": "2025-06-24T16:41:18.784Z",
    "updatedAt": "2025-06-24T16:41:18.784Z",
    "name": "Models 1",
    "description": "Description for models 1",
    "providerId": "providerId_1",
    "active": true
  }
];

// USERS MOCK DATA
export const users = [
  {
    "id": 17,
    "name": "Admin User",
    "emailVerified": "2025-06-24T16:41:18.784Z",
    "image": "image_1"
  },
  {
    "id": 73,
    "name": "Instructional User",
    "email": "instructional@example.com",
    "image": "image_2"
  },
  {
    "id": 46,
    "email": "instructor@example.com",
    "emailVerified": "2025-06-24T16:41:18.784Z",
    "image": "image_3"
  },
  {
    "id": 46,
    "name": "TA User",
    "email": "ta@example.com",
    "emailVerified": "2025-06-24T16:41:18.784Z",
    "image": "image_4"
  }
];

// PROFILES MOCK DATA
export const profiles = [
  {
    "id": "4cd2bdu9-eq0r-yctd-qyrg-pms2ngno1t",
    "updatedAt": "2025-06-24T16:41:18.784Z",
    "userId": 17,
    "lastLogin": "2025-06-24T16:41:18.784Z",
    "firstName": "Admin",
    "lastName": "User",
    "alias": "admin-user",
    "viewedIntro": "viewedIntro_1",
    "createdAt": "2025-06-24T16:41:18.784Z",
    "role": "admin",
    "classIds": [
      "xgx4on74-ep7i-else-4l2x-shtpsem3jcf",
      "7wfpxljs-ft0j-qvjz-g6to-wf71r8jumf"
    ]
  },
  {
    "id": "zyy7wnrv-gljf-mewa-05om-lcnts610y9",
    "updatedAt": "2025-06-24T16:41:18.784Z",
    "userId": 73,
    "lastLogin": "2025-06-24T16:41:18.784Z",
    "firstName": "Instructional",
    "lastName": "User",
    "alias": "instructional-user",
    "viewedIntro": "viewedIntro_2",
    "createdAt": "2025-06-24T16:41:18.784Z",
    "role": "instructional",
    "classIds": [
      "xgx4on74-ep7i-else-4l2x-shtpsem3jcf",
      "7wfpxljs-ft0j-qvjz-g6to-wf71r8jumf"
    ]
  },
  {
    "id": "ea2dqhcl-tibh-cz4p-i7yf-jlmwbdiohk",
    "updatedAt": "2025-06-24T16:41:18.784Z",
    "userId": 46,
    "lastLogin": "2025-06-24T16:41:18.784Z",
    "firstName": "Instructor",
    "lastName": "User",
    "alias": "instructor-user",
    "viewedIntro": "viewedIntro_3",
    "createdAt": "2025-06-24T16:41:18.784Z",
    "role": "instructor",
    "classIds": [
      "xgx4on74-ep7i-else-4l2x-shtpsem3jcf",
      "7wfpxljs-ft0j-qvjz-g6to-wf71r8jumf"
    ]
  },
  {
    "id": "2rz5fvzy-7xic-met3-1f5e-gsy5nb9n0yn",
    "updatedAt": "2025-06-24T16:41:18.784Z",
    "lastLogin": "2025-06-24T16:41:18.784Z",
    "firstName": "TA",
    "lastName": "User",
    "alias": "ta-user",
    "viewedIntro": "viewedIntro_4",
    "createdAt": "2025-06-24T16:41:18.784Z",
    "role": "ta",
    "classIds": [
      "xgx4on74-ep7i-else-4l2x-shtpsem3jcf",
      "7wfpxljs-ft0j-qvjz-g6to-wf71r8jumf"
    ],
    "userId": 46
  }
];

// RUBRICS MOCK DATA
export const rubrics = [
  {
    "id": "xc7gty4l-fi88-afyn-ktug-t51p8hiwjg",
    "createdAt": "2025-06-24T16:41:18.784Z",
    "updatedAt": "2025-06-24T16:41:18.784Z",
    "name": "Math Problem Solving Rubric",
    "description": "Evaluates mathematical reasoning and problem-solving skills",
    "points": 31,
    "passPoints": "passPoints_1",
    "defaultRubric": "defaultRubric_1"
  },
  {
    "id": "r6mn53pz-xn4n-2kuv-mz0u-wixfg38pczk",
    "createdAt": "2025-06-24T16:41:18.784Z",
    "updatedAt": "2025-06-24T16:41:18.784Z",
    "name": "Science Lab Rubric",
    "description": "Assesses lab technique and safety knowledge",
    "points": 36,
    "passPoints": "passPoints_2",
    "defaultRubric": "defaultRubric_2"
  }
];

// STANDARDGROUPS MOCK DATA
export const standardGroups = [
  {
    "id": "dxepwbyr-o70m-633i-8uf8-2k2mzpp5t2p",
    "createdAt": "2025-06-24T16:41:18.784Z",
    "name": "Standard_groups 1",
    "shortName": "shortName_1",
    "description": "Description for standard_groups 1",
    "points": 45,
    "passPoints": "passPoints_1",
    "rubricId": "rubricId_1"
  }
];

// STANDARDS MOCK DATA
export const standards = [
  {
    "id": "xkw0dlo3-ltjl-hv7y-g31x-ro0kv21c75g",
    "createdAt": "2025-06-24T16:41:18.784Z",
    "name": "Standards 1",
    "description": "Description for standards 1",
    "points": 99,
    "standardGroupId": "standardGroupId_1"
  }
];

// APPLOGS MOCK DATA
export const appLogs = [
  {
    "id": 77,
    "level": "level_1",
    "message": "message_1",
    "context": {},
    "createdAt": "2025-06-24T16:41:18.784Z"
  }
];

// ASSISTANTCHATS MOCK DATA
export const assistantChats = [
  {
    "id": "wtkoxhko-3xwu-vkfp-2zmw-xzftqn1duo",
    "createdAt": "2025-06-24T16:41:18.784Z",
    "updatedAt": "2025-06-24T16:41:18.784Z",
    "title": "Assistant_chats 1",
    "profileId": "profileId_1",
    "traceId": "traceId_1"
  }
];

// ASSISTANTMESSAGES MOCK DATA
export const assistantMessages = [
  {
    "id": "t9tnw581-mbe9-ca54-v35z-2pxooau9361",
    "createdAt": "2025-06-24T16:41:18.784Z",
    "updatedAt": "2025-06-24T16:41:18.784Z",
    "completedAt": "2025-06-24T16:41:18.784Z",
    "chatId": "chatId_1",
    "role": "user",
    "content": "content_1",
    "completed": true
  }
];

// ASSISTANTTOOLCALLS MOCK DATA
export const assistantToolCalls = [
  {
    "id": "a6l2b09q-i01u-yg0a-x1rm-yxdp4o6r9fh",
    "createdAt": "2025-06-24T16:41:18.784Z",
    "updatedAt": "2025-06-24T16:41:18.784Z",
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
    "id": "2e5qhnxl-8v1t-3oha-h4sx-gs2d729zbiq",
    "createdAt": "2025-06-24T16:41:18.784Z",
    "updatedAt": "2025-06-24T16:41:18.784Z",
    "name": "Components 1",
    "description": "Description for components 1",
    "fileName": "fileName_1",
    "layout": {},
    "stat": true,
    "defaultComponent": "defaultComponent_1"
  }
];

// SCENARIOS MOCK DATA
export const scenarios = [
  {
    "id": "lv9etrfs-traq-wdzy-7iav-ws5lwutszep",
    "createdAt": "2025-06-24T16:41:18.784Z",
    "updatedAt": "2025-06-24T16:41:18.784Z",
    "name": "Algebra Problem Solving",
    "description": "Students work through complex algebra problems with AI assistance",
    "crowdedness": 23,
    "intensity": 63,
    "seniority": "freshman",
    "defaultScenario": "defaultScenario_1"
  },
  {
    "id": "yd27e5ei-8br3-bmq8-hl4p-vy4tcch4kcc",
    "createdAt": "2025-06-24T16:41:18.784Z",
    "updatedAt": "2025-06-24T16:41:18.784Z",
    "name": "Chemistry Lab Safety",
    "description": "Students learn lab safety protocols through interactive scenarios",
    "agentId": "agentId_2",
    "classId": "classId_2",
    "crowdedness": 97,
    "intensity": 50,
    "seniority": "sophomore",
    "defaultScenario": "defaultScenario_2"
  }
];

// DASHBOARDS MOCK DATA
export const dashboards = [
  {
    "id": "1dpq0db6-7dpj-gxic-e5rh-jdsf3f5m6hd",
    "createdAt": "2025-06-24T16:41:18.784Z",
    "updatedAt": "2025-06-24T16:41:18.784Z",
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

// AGENTS MOCK DATA
export const agents = [
  {
    "id": "nn0o3ot5-2y1q-ls2w-tk7a-u850vyxxb2e",
    "createdAt": "2025-06-24T16:41:18.784Z",
    "updatedAt": "2025-06-24T16:41:18.784Z",
    "name": "Math Tutor Agent",
    "description": "Helps students with mathematical concepts and problem-solving",
    "systemPrompt": "You are a helpful math tutor. Guide students through problems step by step.",
    "temperature": 0.26,
    "defaultAgent": "defaultAgent_1",
    "editable": false,
    "modelId": "modelId_1",
    "reasoning": "low"
  },
  {
    "id": "d28g47l5-nq5c-j5sd-ok0k-8sfgcp40hpu",
    "createdAt": "2025-06-24T16:41:18.784Z",
    "updatedAt": "2025-06-24T16:41:18.784Z",
    "name": "Science Helper Bot",
    "description": "Assists with scientific inquiries and experiments",
    "systemPrompt": "You are a science assistant. Help students understand scientific concepts.",
    "temperature": 0.81,
    "defaultAgent": "defaultAgent_2",
    "editable": true,
    "modelId": "modelId_2",
    "reasoning": "medium"
  }
];

// COHORTS MOCK DATA
export const cohorts = [
  {
    "id": "bcclah0s-zq0d-tsm6-tyru-mqgaaah0xg",
    "createdAt": "2025-06-24T16:41:18.784Z",
    "updatedAt": "2025-06-24T16:41:18.784Z",
    "title": "Fall 2024 Cohort",
    "description": "Students enrolled in fall semester courses",
    "active": true,
    "profileIds": [
      "4cd2bdu9-eq0r-yctd-qyrg-pms2ngno1t",
      "zyy7wnrv-gljf-mewa-05om-lcnts610y9",
      "ea2dqhcl-tibh-cz4p-i7yf-jlmwbdiohk",
      "2rz5fvzy-7xic-met3-1f5e-gsy5nb9n0yn"
    ]
  },
  {
    "id": "x89jnw52-i11g-psjb-htb2-9ruotls7yfd",
    "createdAt": "2025-06-24T16:41:18.784Z",
    "updatedAt": "2025-06-24T16:41:18.784Z",
    "title": "Spring 2024 Advanced",
    "description": "Advanced students in spring programs",
    "active": false,
    "profileIds": [
      "4cd2bdu9-eq0r-yctd-qyrg-pms2ngno1t",
      "zyy7wnrv-gljf-mewa-05om-lcnts610y9",
      "ea2dqhcl-tibh-cz4p-i7yf-jlmwbdiohk",
      "2rz5fvzy-7xic-met3-1f5e-gsy5nb9n0yn"
    ]
  }
];

// SIMULATIONS MOCK DATA
export const simulations = [
  {
    "id": "7fpsbc4k-zqxp-lihf-ae5f-55xe616w6t3",
    "createdAt": "2025-06-24T16:41:18.784Z",
    "updatedAt": "2025-06-24T16:41:18.784Z",
    "title": "Math Practice Simulation",
    "timeLimit": "timeLimit_1",
    "active": true,
    "scenarioIds": [
      "lv9etrfs-traq-wdzy-7iav-ws5lwutszep",
      "yd27e5ei-8br3-bmq8-hl4p-vy4tcch4kcc"
    ],
    "cohortIds": [
      "bcclah0s-zq0d-tsm6-tyru-mqgaaah0xg",
      "x89jnw52-i11g-psjb-htb2-9ruotls7yfd"
    ],
    "rubricId": "rubricId_1",
    "defaultSimulation": "defaultSimulation_1"
  },
  {
    "id": "fr9v0rcv-852t-bpxt-lwd9-7wma0ulqxa4",
    "createdAt": "2025-06-24T16:41:18.784Z",
    "updatedAt": "2025-06-24T16:41:18.784Z",
    "title": "Lab Safety Training",
    "timeLimit": "timeLimit_2",
    "active": false,
    "scenarioIds": [
      "lv9etrfs-traq-wdzy-7iav-ws5lwutszep",
      "yd27e5ei-8br3-bmq8-hl4p-vy4tcch4kcc"
    ],
    "cohortIds": [
      "bcclah0s-zq0d-tsm6-tyru-mqgaaah0xg",
      "x89jnw52-i11g-psjb-htb2-9ruotls7yfd"
    ],
    "rubricId": "rubricId_2",
    "defaultSimulation": "defaultSimulation_2"
  }
];

// SIMULATIONATTEMPTS MOCK DATA
export const simulationAttempts = [
  {
    "id": "cxknqjrj-66wa-qa45-l7fm-1hyx4az79xa",
    "createdAt": "2025-06-24T16:41:18.784Z",
    "profileId": "profileId_1",
    "simulationId": "simulationId_1"
  }
];

// SIMULATIONCHATS MOCK DATA
export const simulationChats = [
  {
    "id": "sgbou87f-kgqv-fyk6-7kaz-dh525y070tf",
    "createdAt": "2025-06-24T16:41:18.784Z",
    "updatedAt": "2025-06-24T16:41:18.784Z",
    "completedAt": "2025-06-24T16:41:18.784Z",
    "title": "Simulation_chats 1",
    "scenarioId": "scenarioId_1",
    "attemptId": "attemptId_1",
    "completed": false
  }
];

// SIMULATIONMESSAGES MOCK DATA
export const simulationMessages = [
  {
    "id": "q8slwr0i-46yo-j6vn-k1gh-p6wzent3a7b",
    "createdAt": "2025-06-24T16:41:18.784Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query",
    "completed": false
  }
];

// SIMULATIONCHATGRADES MOCK DATA
export const simulationChatGrades = [
  {
    "id": "0idb758q-cygf-vjys-ty3w-v48ngwvmf9",
    "createdAt": "2025-06-24T16:41:18.784Z",
    "passed": false,
    "score": 23,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1",
    "simulationChatId": "simulationChatId_1"
  }
];

// SIMULATIONCHATFEEDBACKS MOCK DATA
export const simulationChatFeedbacks = [
  {
    "id": "thn1dwx3-z56c-oyt1-7492-qbp3ipk1t0q",
    "createdAt": "2025-06-24T16:41:18.784Z",
    "standardId": "standardId_1",
    "simulationChatGradeId": "simulationChatGradeId_1",
    "total": 17
  }
];

// EVALS MOCK DATA
export const evals = [
  {
    "id": "edwpjxwo-ds9r-u7v5-30ym-zbha030boa",
    "createdAt": "2025-06-24T16:41:18.784Z",
    "updatedAt": "2025-06-24T16:41:18.784Z",
    "name": "Math Skills Evaluation",
    "description": "Comprehensive evaluation of mathematical problem-solving abilities",
    "baseAgentId": "baseAgentId_1",
    "scenarioIds": [
      "lv9etrfs-traq-wdzy-7iav-ws5lwutszep",
      "yd27e5ei-8br3-bmq8-hl4p-vy4tcch4kcc"
    ],
    "agentIds": [
      "nn0o3ot5-2y1q-ls2w-tk7a-u850vyxxb2e",
      "d28g47l5-nq5c-j5sd-ok0k-8sfgcp40hpu"
    ],
    "rubricIds": [
      "xc7gty4l-fi88-afyn-ktug-t51p8hiwjg",
      "r6mn53pz-xn4n-2kuv-mz0u-wixfg38pczk"
    ],
    "maxTurns": "maxTurns_1",
    "startOnCreation": "startOnCreation_1"
  }
];

// EVALRUNS MOCK DATA
export const evalRuns = [
  {
    "id": "nr1ray3v-hom2-gvuw-bauq-qll4ncqm1c",
    "createdAt": "2025-06-24T16:41:18.784Z",
    "evalId": "evalId_1",
    "agentId": "agentId_1",
    "rubricId": "rubricId_1"
  }
];

// EVALCHATS MOCK DATA
export const evalChats = [
  {
    "id": "c4aqan4o-8lh3-qmq4-vh5d-c42u2ig60es",
    "createdAt": "2025-06-24T16:41:18.784Z",
    "updatedAt": "2025-06-24T16:41:18.784Z",
    "completedAt": "2025-06-24T16:41:18.784Z",
    "title": "Eval_chats 1",
    "scenarioId": "scenarioId_1",
    "evalRunId": "evalRunId_1",
    "completed": false,
    "traceId": "traceId_1"
  }
];

// EVALMESSAGES MOCK DATA
export const evalMessages = [
  {
    "id": "8ssvy10d-ftna-xjfo-ks51-mbimavfzwe",
    "createdAt": "2025-06-24T16:41:18.784Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query",
    "completed": true
  }
];

// EVALCHATGRADES MOCK DATA
export const evalChatGrades = [
  {
    "id": "42aipgkl-yd2j-iijl-kazh-3d26k71183s",
    "createdAt": "2025-06-24T16:41:18.784Z",
    "passed": true,
    "score": 33,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1",
    "evalChatId": "evalChatId_1"
  }
];

// EVALCHATFEEDBACKS MOCK DATA
export const evalChatFeedbacks = [
  {
    "id": "mivqqvgz-phxj-ywy9-80u9-zhoh2gzxif",
    "createdAt": "2025-06-24T16:41:18.784Z",
    "standardId": "standardId_1",
    "evalChatGradeId": "evalChatGradeId_1",
    "total": 56,
    "feedback": "feedback_1"
  }
];

// VERIFICATIONTOKEN MOCK DATA
export const verificationToken = [
  {
    "identifier": "identifier_1",
    "expires": "2025-06-24T16:41:18.784Z",
    "token": "token_1"
  }
];

