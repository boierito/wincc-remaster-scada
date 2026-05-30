insert into projects (id, name, description) values
('10000000-0000-0000-0000-000000000001', 'Demo Plant', 'Motor, valve and conveyor clean-room SCADA demo')
on conflict do nothing;

insert into communication_providers (id, project_id, key, name, driver, capabilities) values
('10000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000001', 's7', 'Siemens S7 via Node-RED', 'node-red-contrib-s7', '{"read":true,"write":true,"symbols":true}'),
('10000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000001', 'opcua', 'OPC UA via Node-RED', 'node-red-contrib-opcua', '{"browse":true,"monitor":true,"read":true,"write":true}')
on conflict do nothing;

insert into connections (id, provider_id, project_id, name, endpoint, state, options) values
('10000000-0000-0000-0000-000000000020', '10000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000001', 'PLC_Main', '192.168.0.10', 'disabled', '{"rack":0,"slot":1}'),
('10000000-0000-0000-0000-000000000021', '10000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000001', 'OPCUA_Skid', 'opc.tcp://127.0.0.1:4840', 'disabled', '{"securityPolicy":"None","securityMode":"None"}')
on conflict do nothing;

insert into plc_symbols (id, project_id, connection_id, provider_key, symbol_path, address, data_type, direction, structure) values
('10000000-0000-0000-0000-000000000060','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000020','s7','Motor01.Running','DB1,X0.0','bool','readWrite','{}'),
('10000000-0000-0000-0000-000000000061','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000020','s7','Motor01.Fault','DB1,X0.1','bool','readWrite','{}'),
('10000000-0000-0000-0000-000000000062','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000020','s7','Motor01.Speed','DB1,REAL2','float32','readWrite','{}'),
('10000000-0000-0000-0000-000000000063','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000021','opcua','Conveyor01.Speed','ns=2;s=Conveyor01.Speed','float32','readWrite','{}')
on conflict do nothing;

insert into connection_diagnostics (connection_id, state, quality, message, details) values
('10000000-0000-0000-0000-000000000020','disabled','stale','Connection is configured but disabled','{"source":"seed"}'),
('10000000-0000-0000-0000-000000000021','disabled','stale','Connection is configured but disabled','{"source":"seed"}');

insert into tag_groups (id, project_id, name) values
('10000000-0000-0000-0000-000000000030', '10000000-0000-0000-0000-000000000001', 'Plant'),
('10000000-0000-0000-0000-000000000031', '10000000-0000-0000-0000-000000000001', 'System')
on conflict do nothing;

insert into udt_types (id, project_id, name, fields) values
('10000000-0000-0000-0000-000000000040', '10000000-0000-0000-0000-000000000001', 'EquipmentStatus', '[{"name":"Running","dataType":"bool"},{"name":"Fault","dataType":"bool"},{"name":"Speed","dataType":"float32"},{"name":"CommandStart","dataType":"bool"},{"name":"CommandStop","dataType":"bool"}]')
on conflict do nothing;

insert into tags (id, project_id, group_id, connection_id, udt_type_id, name, path, scope, data_type, address, properties) values
('10000000-0000-0000-0000-000000000101','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000030','10000000-0000-0000-0000-000000000020',null,'Running','Motor01.Running','external','bool','DB1,X0.0','{}'),
('10000000-0000-0000-0000-000000000102','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000030','10000000-0000-0000-0000-000000000020',null,'Fault','Motor01.Fault','external','bool','DB1,X0.1','{}'),
('10000000-0000-0000-0000-000000000103','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000030','10000000-0000-0000-0000-000000000020',null,'Speed','Motor01.Speed','external','float32','DB1,REAL2','{}'),
('10000000-0000-0000-0000-000000000111','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000030','10000000-0000-0000-0000-000000000020',null,'Open','Valve01.Open','external','bool','DB2,X0.0','{}'),
('10000000-0000-0000-0000-000000000112','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000030','10000000-0000-0000-0000-000000000020',null,'Fault','Valve01.Fault','external','bool','DB2,X0.1','{}'),
('10000000-0000-0000-0000-000000000121','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000030','10000000-0000-0000-0000-000000000020',null,'Running','Conveyor01.Running','external','bool','DB3,X0.0','{}'),
('10000000-0000-0000-0000-000000000122','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000030','10000000-0000-0000-0000-000000000020',null,'Speed','Conveyor01.Speed','external','float32','DB3,REAL2','{}'),
('10000000-0000-0000-0000-000000000130','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000031',null,null,'ConnectionEnabled','@System.PLC_Main.ConnectionEnabled','system','bool',null,'{}'),
('10000000-0000-0000-0000-000000000131','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000031',null,null,'ConnectionState','@System.PLC_Main.ConnectionState','system','string',null,'{}')
on conflict do nothing;

insert into screens (id, project_id, name, width, height, background) values
('10000000-0000-0000-0000-000000000200', '10000000-0000-0000-0000-000000000001', 'Main', 1366, 768, '{"color":"#0f1720"}'),
('10000000-0000-0000-0000-000000000201', '10000000-0000-0000-0000-000000000001', 'EquipmentPopup', 640, 420, '{"color":"#111827"}')
on conflict do nothing;

insert into screen_objects (id, screen_id, type, name, x, y, width, height, z_index, properties, bindings, events) values
('10000000-0000-0000-0000-000000000210','10000000-0000-0000-0000-000000000200','text','Title',32,24,380,40,1,'{"text":"Demo Plant Runtime","fontSize":28,"fill":"#e5edf5"}','{}','{}'),
('10000000-0000-0000-0000-000000000211','10000000-0000-0000-0000-000000000200','faceplate','Motor01',80,120,260,180,2,'{"faceplateInstanceId":"10000000-0000-0000-0000-000000000310"}','{}','{}'),
('10000000-0000-0000-0000-000000000212','10000000-0000-0000-0000-000000000200','faceplate','Valve01',400,120,260,180,2,'{"faceplateInstanceId":"10000000-0000-0000-0000-000000000311"}','{}','{}'),
('10000000-0000-0000-0000-000000000213','10000000-0000-0000-0000-000000000200','trend','ConveyorSpeedTrend',80,360,580,260,2,'{"archive":"Conveyor speed","title":"Conveyor speed"}','{"value":"Conveyor01.Speed"}','{}'),
('10000000-0000-0000-0000-000000000214','10000000-0000-0000-0000-000000000200','alarmTable','ActiveAlarms',720,120,560,500,2,'{"title":"Active alarms"}','{}','{}'),
('10000000-0000-0000-0000-000000000215','10000000-0000-0000-0000-000000000200','pictureWindow','MotorPopupWindow',1000,620,300,120,3,'{"screen":"EquipmentPopup","tagPrefix":"Motor01","title":"Motor details"}','{}','{}')
on conflict do nothing;

insert into graphic_resources (id, project_id, name, kind, uri, metadata) values
('10000000-0000-0000-0000-000000000220','10000000-0000-0000-0000-000000000001','Motor symbol','symbol','assets/motor.svg','{"cleanRoom":true,"role":"equipment"}'),
('10000000-0000-0000-0000-000000000221','10000000-0000-0000-0000-000000000001','Valve symbol','symbol','assets/valve.svg','{"cleanRoom":true,"role":"equipment"}')
on conflict do nothing;

insert into object_groups (id, screen_id, name, object_ids, properties) values
('10000000-0000-0000-0000-000000000230','10000000-0000-0000-0000-000000000200','Equipment overview','{10000000-0000-0000-0000-000000000211,10000000-0000-0000-0000-000000000212}','{"locked":false}')
on conflict do nothing;

insert into faceplate_types (id, project_id, name, version, interface, composition) values
('10000000-0000-0000-0000-000000000300','10000000-0000-0000-0000-000000000001','EquipmentFaceplate',1,'{"tags":[{"name":"running","dataType":"bool","required":true},{"name":"fault","dataType":"bool","required":true},{"name":"speed","dataType":"float32","required":false}],"properties":[{"name":"title","dataType":"string","defaultValue":"Equipment"}],"commands":[{"name":"start"},{"name":"stop"}],"events":[{"name":"onOpen"}]}','[]')
on conflict do nothing;

insert into faceplate_instances (id, project_id, screen_id, type_id, type_version, name, tag_bindings, property_overrides) values
('10000000-0000-0000-0000-000000000310','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000200','10000000-0000-0000-0000-000000000300',1,'Motor01','{"running":"Motor01.Running","fault":"Motor01.Fault","speed":"Motor01.Speed"}','{"title":"Motor 01"}'),
('10000000-0000-0000-0000-000000000311','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000200','10000000-0000-0000-0000-000000000300',1,'Valve01','{"running":"Valve01.Open","fault":"Valve01.Fault"}','{"title":"Valve 01"}')
on conflict do nothing;

insert into alarm_classes (id, project_id, name, severity, color) values
('10000000-0000-0000-0000-000000000400','10000000-0000-0000-0000-000000000001','Fault',800,'#ef4444')
on conflict do nothing;

insert into alarms (id, project_id, class_id, source_tag_id, name, condition, message_template) values
('10000000-0000-0000-0000-000000000410','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000400','10000000-0000-0000-0000-000000000102','Motor fault','{"operator":"equals","value":true}','Motor 01 fault active'),
('10000000-0000-0000-0000-000000000411','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000400','10000000-0000-0000-0000-000000000112','Valve fault','{"operator":"equals","value":true}','Valve 01 fault active')
on conflict do nothing;

insert into alarm_events (id, alarm_id, project_id, state, message, value) values
('10000000-0000-0000-0000-000000000420','10000000-0000-0000-0000-000000000410','10000000-0000-0000-0000-000000000001','active','Motor 01 fault active','true')
on conflict do nothing;

insert into historian_archives (id, project_id, tag_id, name, sample_mode, cycle_ms) values
('10000000-0000-0000-0000-000000000500','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000103','Motor speed','cyclic',1000),
('10000000-0000-0000-0000-000000000501','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000122','Conveyor speed','cyclic',1000)
on conflict do nothing;

insert into historian_samples (archive_id, tag_id, ts, value, quality, source) values
('10000000-0000-0000-0000-000000000501','10000000-0000-0000-0000-000000000122', now() - interval '4 minutes', '18.2', 'good', 'seed'),
('10000000-0000-0000-0000-000000000501','10000000-0000-0000-0000-000000000122', now() - interval '3 minutes', '20.1', 'good', 'seed'),
('10000000-0000-0000-0000-000000000501','10000000-0000-0000-0000-000000000122', now() - interval '2 minutes', '19.7', 'good', 'seed'),
('10000000-0000-0000-0000-000000000501','10000000-0000-0000-0000-000000000122', now() - interval '1 minutes', '21.4', 'good', 'seed')
on conflict do nothing;

insert into scripts (id, project_id, owner_kind, owner_id, name, language, trigger, source) values
('10000000-0000-0000-0000-000000000600','10000000-0000-0000-0000-000000000001','global',null,'GlobalStartup','vbs-compat','{"type":"startup"}','HMIRuntime.Tags("Motor01.Speed").Read()'),
('10000000-0000-0000-0000-000000000601','10000000-0000-0000-0000-000000000001','tag','10000000-0000-0000-0000-000000000102','MotorFaultTrigger','javascript','{"type":"tag-change","tag":"Motor01.Fault"}','if (api.readTag("Motor01.Fault")) api.openPicture("EquipmentPopup", "Motor01");'),
('10000000-0000-0000-0000-000000000602','10000000-0000-0000-0000-000000000001','global',null,'HeartbeatTimer','javascript','{"type":"timer","intervalMs":5000}','api.writeTag("@System.PLC_Main.ConnectionState", "checked");')
on conflict do nothing;

insert into text_libraries (id, project_id, name, default_locale) values
('10000000-0000-0000-0000-000000000700','10000000-0000-0000-0000-000000000001','Default','en-US')
on conflict do nothing;

insert into text_list_items (library_id, list_name, key, locale, text) values
('10000000-0000-0000-0000-000000000700','EquipmentState','running','en-US','Running'),
('10000000-0000-0000-0000-000000000700','EquipmentState','stopped','en-US','Stopped'),
('10000000-0000-0000-0000-000000000700','EquipmentState','fault','en-US','Fault')
on conflict do nothing;

insert into graphic_lists (id, project_id, name) values
('10000000-0000-0000-0000-000000000710','10000000-0000-0000-0000-000000000001','EquipmentIcons')
on conflict do nothing;

insert into graphic_list_items (list_id, key, asset_ref, metadata) values
('10000000-0000-0000-0000-000000000710','motor','assets/motor.svg','{"cleanRoom":true}'),
('10000000-0000-0000-0000-000000000710','valve','assets/valve.svg','{"cleanRoom":true}')
on conflict do nothing;

insert into groups (id, project_id, name, timeout_seconds) values
('10000000-0000-0000-0000-000000000800','10000000-0000-0000-0000-000000000001','Operators',900),
('10000000-0000-0000-0000-000000000801','10000000-0000-0000-0000-000000000001','Engineers',1800)
on conflict do nothing;

insert into users (id, project_id, username, display_name, password_hash, enabled) values
('10000000-0000-0000-0000-000000000810','10000000-0000-0000-0000-000000000001','operator','Demo Operator','scrypt$16384$8$1$p-VDF7hwtijNAQK8pemewQ$SKobKJX23GIfhPJhjTNaaFpj44KpHAVWudpF-dX95EG7rS4XxdFnPgM85IT-cWe_ARl3T1VoFLjfnL5s7udE8A',true),
('10000000-0000-0000-0000-000000000811','10000000-0000-0000-0000-000000000001','engineer','Demo Engineer','scrypt$16384$8$1$DYyO2tUn8et4Sct5slquUA$-ZxLIqLEBzNAgUigCblPUECitzuTUqBqsdqhhNVcJV8VvvV8LTlie-vr2ZXuG45HGTSVkhdTPLCBedQxhy21yg',true)
on conflict (project_id, username)
do update set password_hash = excluded.password_hash, display_name = excluded.display_name, enabled = excluded.enabled;

insert into user_groups (user_id, group_id) values
('10000000-0000-0000-0000-000000000810','10000000-0000-0000-0000-000000000800'),
('10000000-0000-0000-0000-000000000811','10000000-0000-0000-0000-000000000801')
on conflict do nothing;

insert into permissions (project_id, group_id, key, allowed) values
('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000800','runtime.ack',true),
('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000801','engineering.edit',true),
('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000801','runtime.write',true)
on conflict do nothing;

insert into user_archives (id, project_id, name, schema, rows) values
('10000000-0000-0000-0000-000000000900','10000000-0000-0000-0000-000000000001','MaintenanceLog','[{"name":"ts","type":"datetime"},{"name":"equipment","type":"string"},{"name":"note","type":"string"}]','[{"ts":"2026-05-30T00:00:00Z","equipment":"Motor01","note":"Demo inspection"}]')
on conflict do nothing;

insert into reports (id, project_id, name, template, output_options) values
('10000000-0000-0000-0000-000000000950','10000000-0000-0000-0000-000000000001','Shift summary','{"sections":[{"kind":"alarms","title":"Alarm summary"},{"kind":"historian","archive":"Conveyor speed"}]}','{"formats":["pdf","csv"],"paper":"A4"}')
on conflict do nothing;
