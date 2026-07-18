export const AFFIX_SEARCH_CONFIG_VERSION = '1';

const freezeConfig = config => Object.freeze(Object.fromEntries(
  Object.entries(config).map(([language, values]) => [language, Object.freeze({
    safePrefixes: Object.freeze(values.safePrefixes || []),
    restrictedPrefixes: Object.freeze(values.restrictedPrefixes || []),
    combiningForms: Object.freeze(values.combiningForms || []),
    suffixes: Object.freeze(values.suffixes || []),
    compoundLinkers: Object.freeze(values.compoundLinkers || [])
  })])
));

export const AFFIX_SEARCH_CONFIG = freezeConfig({
  en: {
    safePrefixes: ['after','anti','arch','auto','be','co','counter','de','dis','en','em','ex','extra','fore','hyper','hypo','inter','intra','macro','mal','mega','micro','mid','mini','mis','mono','multi','neo','non','out','over','pan','para','peri','poly','post','pre','pro','proto','pseudo','quasi','re','retro','self','semi','sub','super','supra','trans','ultra','under','un','vice'],
    restrictedPrefixes: ['a','bi','by','cross','down','in','il','im','ir','off','on','tri','up'],
    combiningForms: ['aero','agri','agro','allo','ambi','amphi','andro','anthropo','astro','bio','cardio','chrono','demo','eco','electro','geo','hetero','homo','hydro','iso','logo','meta','nano','neuro','omni','paleo','photo','psycho','socio','techno','tele','theo','thermo','uni','xeno','zoo'],
    suffixes: ['age','al','ance','ence','ancy','ency','ant','ent','an','ian','arian','ary','ery','ory','dom','ee','eer','er','or','ess','ette','hood','ing','ion','ation','ition','tion','sion','xion','ism','ist','ity','ty','let','ling','ment','ness','ship','th','ure','cy','able','ible','esque','ful','ic','ical','ine','ish','ive','less','like','ly','oid','ous','eous','ious','some','y','ate','en','ify','fy','ise','ize','ward','wards','wise']
  },
  de: {
    safePrefixes: ['be','emp','ent','er','ge','miss','un','ur','ver','zer','erz','anti','de','des','dis','ex','hyper','inter','ko','kontra','mini','neo','non','post','prä','pro','pseudo','re','sub','super','trans','ultra'],
    restrictedPrefixes: ['ab','an','auf','aus','bei','dar','durch','ein','empor','entgegen','entlang','fest','fort','frei','gegen','heim','her','hin','hinter','los','mit','nach','nieder','über','um','unter','voll','vor','weg','weiter','wider','wieder','zu','zurück','zusammen'],
    combiningForms: ['aero','agro','astro','auto','bio','elektro','geo','hetero','homo','hydro','makro','mega','mikro','mono','multi','nano','neuro','öko','paleo','photo','poly','psycho','sozio','techno','tele','thermo','xeno','zoo'],
    suffixes: ['e','ei','erei','er','ler','ner','in','chen','lein','ling','heit','keit','igkeit','schaft','ung','nis','tum','sal','sel','icht','age','anz','enz','at','ator','eur','ik','ion','ismus','ist','ität','ment','tion','sion','ur','bar','fach','förmig','frei','haft','ig','isch','lich','los','mäßig','reich','sam','voll','wert','en','eln','ern','ieren','ifizieren','isieren','halber','weise','wärts'],
    compoundLinkers: ['s','es','n','en','e','er']
  },
  fr: {
    safePrefixes: ['anti','anté','archi','auto','bi','bis','co','contre','dé','dés','dys','en','em','entre','ex','extra','hyper','hypo','infra','inter','intra','mal','mé','més','micro','mini','mono','multi','néo','non','outre','para','péri','poly','post','pré','pro','proto','pseudo','quasi','re','ré','rétro','semi','sous','super','supra','sur','trans','tri','ultra','vice'],
    restrictedPrefixes: ['a','ad','ac','af','ag','al','an','ap','ar','as','at','col','com','con','cor','e','ef','in','im','il','ir','mau'],
    combiningForms: ['aéro','agro','allo','amphi','anthropo','astro','bio','cardio','chrono','démo','éco','électro','géo','hétéro','homo','hydro','iso','macro','méga','nano','neuro','omni','paléo','photo','psycho','socio','techno','télé','thermo','xéno','zoo'],
    suffixes: ['age','ade','ail','aille','ain','aine','ais','aise','ance','ence','ant','ante','ard','arde','at','ateur','atrice','ation','ition','tion','sion','aison','ison','ée','erie','esse','eur','euse','ier','ière','isme','iste','ité','té','itude','ment','oir','oire','ure','able','ible','al','ale','el','elle','éen','éenne','ien','ienne','esque','eux','if','ive','ique','âtre','er','ir','ifier','iser','amment','emment','et','ette','elet','elette','ot','otte','on','onne','illon','ille','asse','aud','aude']
  },
  es: {
    safePrefixes: ['anti','ante','archi','arqui','auto','bi','bis','circun','circum','co','contra','des','dis','en','em','entre','ex','extra','hiper','hipo','infra','inter','intra','mal','micro','mini','mono','multi','neo','no','para','peri','pluri','poli','pos','post','pre','pro','proto','pseudo','seudo','cuasi','re','retro','semi','sobre','sub','super','supra','trans','tras','tri','ultra','vice'],
    restrictedPrefixes: ['a','ad','de','col','com','con','cor','i','im','in','sin'],
    combiningForms: ['aero','agro','alo','anfi','antropo','astro','bio','cardio','crono','demo','eco','electro','geo','hetero','homo','hidro','iso','macro','mega','nano','neuro','omni','paleo','foto','psico','socio','tecno','tele','termo','xeno','zoo'],
    suffixes: ['aje','al','ancia','encia','ante','ente','iente','ario','aria','ería','azgo','ción','sión','ión','dad','edad','idad','dor','dora','tor','tora','sor','sora','ero','era','ez','eza','ia','ismo','ista','miento','amiento','imiento','ura','umbre','anza','able','ible','ano','ana','iano','iana','enco','enca','ense','eño','eña','esco','esca','ico','ica','il','ino','ina','ivo','iva','izo','iza','oso','osa','udo','uda','orio','oria','iento','ienta','ento','enta','uno','una','ísimo','ísima','érrimo','érrima','ar','ear','ecer','ificar','izar','mente','ito','ita','illo','illa','uelo','uela','ete','eta','ín','ón','ona','azo','aza','ote','ota','ucho','ucha']
  },
  it: {
    safePrefixes: ['anti','ante','arci','archi','auto','bi','bis','circon','circum','co','con','contro','de','dis','ex','extra','fra','infra','inter','intra','iper','ipo','mal','micro','mini','mono','multi','neo','non','oltre','para','peri','pluri','poli','post','pre','pro','proto','pseudo','quasi','re','ri','retro','semi','sopra','sovra','sotto','stra','sub','super','supra','trans','tras','tri','ultra','vice'],
    restrictedPrefixes: ['a','ad','ac','af','ag','al','an','ap','ar','as','at','col','com','cor','in','im','il','ir','s'],
    combiningForms: ['aero','agro','allo','anfi','antropo','astro','bio','cardio','crono','demo','eco','elettro','geo','etero','omo','idro','iso','macro','mega','nano','neuro','onni','paleo','foto','psico','socio','tecno','tele','termo','xeno','zoo'],
    suffixes: ['aggio','aio','aia','ale','ame','anza','enza','ario','aria','ato','ata','atore','atrice','azione','izione','zione','sione','ione','eria','ezza','ia','iere','iera','ificio','ismo','ista','ità','tà','mento','ore','ura','itudine','ume','abile','ibile','ano','ana','iano','iana','ante','ente','ito','ita','esco','esca','evole','ico','ica','ile','ino','ina','ivo','iva','oso','osa','orio','oria','are','ere','ire','eggiare','ificare','izzare','mente','etto','etta','ello','ella','uccio','uccia','otto','otta','icciolo','icciola','accio','accia','astro','astra','one','ona','acchione','acchiona','ucolo','ucola']
  },
  ru: {
    safePrefixes: ['без','бес','воз','вос','вз','вс','взо','во','вы','до','за','из','ис','изо','на','над','надо','не','недо','низ','нис','обез','обес','об','обо','от','ото','пере','по','под','подо','пред','предо','при','про','раз','рас','разо','со','через','черес','вне','внутри','меж','между','около','после','противо','сверх','полу','пра','анти','гипер','гипо','интер','интра','квази','контр','макро','микро','мини','моно','мульти','нео','пан','пара','поли','пост','пре','прото','псевдо','ретро','суб','супер','транс','ультра','экс'],
    restrictedPrefixes: ['в','с','у','о'],
    combiningForms: ['авиа','авто','агро','астро','био','гео','гидро','зоо','кино','космо','макро','мега','микро','нано','нейро','радио','само','взаимо','много','мало','одно','дву','двух','трех','обще','лже','психо','социо','техно','теле','термо','фото','электро','энерго'],
    suffixes: ['к','ик','ник','еник','чик','щик','тель','ист','изм','ость','ство','ение','ание','ние','ация','изация','ование','мент','тор','атор','ор','ер','арь','ец','иц','ин','анин','янин','ак','як','ач','ун','ыш','няк','ня','ищ','от','изн','б','тв','овк','ировк','н','енн','онн','ск','еск','ическ','ов','ев','ын','ан','ян','лив','чив','чат','оват','еват','еньк','оньк','тельн','абельн','ова','ева','ирова','изирова','ифицирова','ыва','ива','ну','нича','ствова','ски','цки','ьи','ок','ек','очк','ечк','ушк','юшк','ишк','енк','онк'],
    compoundLinkers: ['о','е','и']
  }
});

export function getAffixSearchConfig(language) {
  return AFFIX_SEARCH_CONFIG[String(language || 'en').toLowerCase()] || AFFIX_SEARCH_CONFIG.en;
}
