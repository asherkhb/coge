//>>built
require({cache:{"JBrowse/Store/SeqFeature/GlobalStatsEstimationMixin":function(){define("JBrowse/Store/SeqFeature/GlobalStatsEstimationMixin",["dojo/_base/declare","dojo/_base/array"],function(m,q){return m(null,{_estimateGlobalStats:function(o){var g=function(d,e,g){var l=this,a=0.75*d.start+0.25*d.end,k=Math.max(0,Math.round(a-e/2)),c=Math.min(Math.round(a+e/2),d.end),b=[];this._getFeatures({ref:d.name,start:k,end:c},function(n){b.push(n)},function(){b=q.filter(b,function(b){return b.get("start")>=
k&&b.get("end")<=c});g.call(l,e,{featureDensity:b.length/e,_statsSampleFeatures:b.length,_statsSampleInterval:{ref:d.name,start:k,end:c,length:e}})},function(b){console.error(b);g.call(l,e,null,b)})},h=function(d,e,i){if(i)o(null,i);else{var l=this.refSeq.end-this.refSeq.start;300<=e._statsSampleFeatures||2*d>l||i?o(e):g.call(this,this.refSeq,2*d,h)}};g.call(this,this.refSeq,100,h)}})})},"JBrowse/Store/SeqFeature/BAM/File":function(){define("dojo/_base/declare,dojo/_base/array,JBrowse/has,JBrowse/Util,JBrowse/Errors,JBrowse/Store/LRUCache,./Util,./LazyFeature".split(","),
function(m,q,o,g,h,d,e,i){var l=function(){console.error.apply(console,arguments)},a=g.fastDeclare({constructor:function(b,n,a){this.minv=b;this.maxv=n;this.bin=a},toUniqueString:function(){return this.minv+".."+this.maxv+" (bin "+this.bin+")"},toString:function(){return this.toUniqueString()},fetchedSize:function(){return this.maxv.block+65536-this.minv.block+1}}),k=e.readInt,c=e.readVirtualOffset;return m(null,{constructor:function(b){this.store=b.store;this.data=b.data;this.bai=b.bai;this.chunkSizeLimit=
b.chunkSizeLimit||5E6},init:function(b){var n=b.success||function(){},a=b.failure||function(b){console.error(b,b.stack)};this._readBAI(dojo.hitch(this,function(){this._readBAMheader(function(){n()},a)}),a)},_readBAI:function(b,n){this.bai.fetch(dojo.hitch(this,function(a){if(a)if(o("typed-arrays")){var f=new Uint8Array(a);if(21578050!=k(f,0))l("Not a BAI file"),n("Not a BAI file");else{var e=k(f,4);this.indices=[];for(var j=8,d=0;d<e;++d){for(var g=j,h=k(f,j),j=j+4,i=0;i<h;++i){k(f,j);for(var m=k(f,
j+4),j=j+8,p=0;p<m;p++)this._findMinAlignment(c(f,j)),j+=16}i=k(f,j);j+=4;this._findMinAlignment(i?c(f,j):null);j+=8*i;if(0<h||0<i)this.indices[d]=new Uint8Array(a,g,j-g)}this.empty=!this.indices.length;b(this.indices,this.minAlignmentVO)}}else l("Web browser does not support typed arrays"),n("Web browser does not support typed arrays");else l("No data read from BAM index (BAI) file"),n("No data read from BAM index (BAI) file")}),n)},_findMinAlignment:function(b){if(b&&(!this.minAlignmentVO||0>this.minAlignmentVO.cmp(b)))this.minAlignmentVO=
b},_readBAMheader:function(b,n){var a=this;a.data.read(0,a.minAlignmentVO?a.minAlignmentVO.block+65535:null,function(f){f=e.unbgzf(f);f=new Uint8Array(f);21840194!=k(f,0)?(l("Not a BAM file"),n("Not a BAM file")):(f=k(f,4),a._readRefSeqs(f+8,262144,b,n))},n)},_readRefSeqs:function(b,a,c,f){var d=this;d.data.read(0,b+a,function(j){var j=e.unbgzf(j),j=new Uint8Array(j),g=k(j,b),i=b+4;d.chrToIndex={};d.indexToChr=[];for(var h=0;h<g;++h){for(var l=k(j,i),m="",p=0;p<l-1;++p)m+=String.fromCharCode(j[i+
4+p]);p=k(j,i+l+4);d.chrToIndex[d.store.browser.regularizeReferenceName(m)]=h;d.indexToChr.push({name:m,length:p});i=i+8+l;if(i>j.length){a*=2;console.warn("BAM header is very big.  Re-fetching "+a+" bytes.");d._readRefSeqs(b,a,c,f);return}}c()},f)},blocksForRange:function(b,n,d){var f=this.indices[b];if(!f)return[];for(var b=function(){for(var b={},a=this._reg2bins(n,d),f=0;f<a.length;++f)b[a[f]]=!0;return b}.call(this),e=[],j=[],g=k(f,0),i=4,h=0;h<g;++h){var l=k(f,i),m=k(f,i+4),i=i+8;if(b[l])for(var p=
0;p<m;++p){var o=c(f,i),q=c(f,i+8);(4681>l?j:e).push(new a(o,q,l));i+=16}else i+=16*m}var r=function(){for(var b=null,a=k(f,i),e=Math.min(n>>14,a-1),a=Math.min(d>>14,a-1);e<=a;++e){var j=c(f,i+4+8*e);if(j&&(!b||0>j.cmp(b)))b=j}return b}(),j=function(b){var a=[];if(null!=r)for(var n=0;n<b.length;++n){var f=b[n];f.maxv.block>=r.block&&f.maxv.offset>=r.offset&&a.push(f)}return a}(j),b=j.concat(e).sort(function(b,a){return b.minv.block-a.minv.block||b.minv.offset-a.minv.offset}),e=[];if(b.length){j=b[0];
for(g=1;g<b.length;++g)h=b[g],h.minv.block==j.maxv.block?j=new a(j.minv,h.maxv,"merged"):(e.push(j),j=h);e.push(j)}return e},fetch:function(b,a,c,f,e,k){var b=this.store.browser.regularizeReferenceName(b),b=this.chrToIndex&&this.chrToIndex[b],d;0<=b?(d=this.blocksForRange(b,a,c))||callback(null,new h.Fatal("Error in index fetch")):d=[];d.toString=function(){return this.join(", ")};try{this._fetchChunkFeatures(d,b,a,c,f,e,k)}catch(i){k(i)}},_fetchChunkFeatures:function(b,a,c,f,k,e,i){if(b.length){for(var l=
0,m=this.featureCache=this.featureCache||new d({name:"bamFeatureCache",fillCallback:dojo.hitch(this,"_readChunk"),sizeFunction:function(b){return b.length},maxSize:1E5}),o=0;o<b.length;o++){var s=b[o].fetchedSize();if(s>this.chunkSizeLimit){i(new h.DataOverflow("Too many BAM features. BAM chunk size "+g.commifyNumber(s)+" bytes exceeds chunkSizeLimit of "+g.commifyNumber(this.chunkSizeLimit)+"."));return}}var p;q.forEach(b,function(d){m.get(d,function(d,g){g&&!p&&i(g);if(!(p=p||g)){for(var h=0;h<
d.length;h++){var m=d[h];if(m._refID==a)if(m.get("start")>f)break;else m.get("end")>=c&&k(m)}++l==b.length&&e()}})})}else e()},_readChunk:function(b,a){var c=this,f=[];c.data.read(b.minv.block,b.fetchedSize(),function(d){try{var k=e.unbgzf(d,b.maxv.block-b.minv.block+1);c.readBamFeatures(new Uint8Array(k),b.minv.offset,f,a)}catch(i){a(null,new h.Fatal(i))}},function(b){a(null,new h.Fatal(b))})},readBamFeatures:function(b,a,c,f){for(var d=this,e=0;;)if(a>=b.length){f(c);break}else if(300>=e){var g=
k(b,a),g=a+4+g-1;if(g<b.length){var h=new i({store:this.store,file:this,bytes:{byteArray:b,start:a,end:g}});c.push(h);e++}a=g+1}else{window.setTimeout(function(){d.readBamFeatures(b,a,c,f)},1);break}},_reg2bin:function(b,a){--a;return b>>14==a>>14?4681+(b>>14):b>>17==a>>17?585+(b>>17):b>>20==a>>20?73+(b>>20):b>>23==a>>23?9+(b>>23):b>>26==a>>26?1+(b>>26):0},MAX_BIN:37449,_reg2bins:function(b,a){var c,f=[0];--a;for(c=1+(b>>26);c<=1+(a>>26);++c)f.push(c);for(c=9+(b>>23);c<=9+(a>>23);++c)f.push(c);for(c=
73+(b>>20);c<=73+(a>>20);++c)f.push(c);for(c=585+(b>>17);c<=585+(a>>17);++c)f.push(c);for(c=4681+(b>>14);c<=4681+(a>>14);++c)f.push(c);return f}})})},"JBrowse/Store/SeqFeature/BAM/Util":function(){define(["jszlib/inflate","jszlib/arrayCopy","JBrowse/Util"],function(m,q,o){var g=o.fastDeclare({constructor:function(d,e){this.block=d;this.offset=e},toString:function(){return""+this.block+":"+this.offset},cmp:function(d){return d.block-this.block||d.offset-this.offset}}),h={readInt:function(d,e){return d[e+
3]<<24|d[e+2]<<16|d[e+1]<<8|d[e]},readShort:function(d,e){return d[e+1]<<8|d[e]},readFloat:function(d,e){for(var g=new Uint8Array(4),h=0;4>h;h++)g[h]=d[e+h];return(new Float32Array(g.buffer))[0]},readVirtualOffset:function(d,e){var i=4294967296*(d[e+6]&255)+16777216*(d[e+5]&255)+65536*(d[e+4]&255)+256*(d[e+3]&255)+(d[e+2]&255),h=d[e+1]<<8|d[e];return 0==i&&0==h?null:new g(i,h)},unbgzf:function(d,e){for(var e=Math.min(e||Infinity,d.byteLength-27),g=[],l=0,a=[0];a[0]<e;a[0]+=8){var k=new Uint8Array(d,
a[0],18);if(!(31==k[0]&&139==k[1])){console.error("invalid BGZF block header, skipping",k);break}var k=h.readShort(k,10),k=a[0]+12+k,c;try{c=m(d,k,d.byteLength-k,a)}catch(b){if(/^Z_BUF_ERROR/.test(b.statusString)&&g.length)break;else throw b;}c.byteLength&&(l+=c.byteLength,g.push(c))}if(1==g.length)return g[0];l=new Uint8Array(l);for(c=a=0;c<g.length;++c)k=new Uint8Array(g[c]),q(k,0,l,a,k.length),a+=k.length;return l.buffer}};return h})},"JBrowse/Store/SeqFeature/BAM/LazyFeature":function(){define(["dojo/_base/array",
"JBrowse/Util","./Util","JBrowse/Model/SimpleFeature"],function(m,q,o,g){var h="=,A,C,x,G,x,x,x,T,x,x,x,x,x,x,N".split(","),d="M,I,D,N,S,H,P,=,X,?,?,?,?,?,?,?".split(","),e=o.readInt,i=o.readShort,l=o.readFloat;return q.fastDeclare({constructor:function(a){this.store=a.store;this.file=a.file;this.data={type:"match",source:a.store.source};this.bytes={start:a.bytes.start,end:a.bytes.end,byteArray:a.bytes.byteArray};this._coreParse()},get:function(a){return this._get(a.toLowerCase())},_get:function(a){return a in
this.data?this.data[a]:this.data[a]=this[a]?this[a]():this._flagMasks[a]?this._parseFlag(a):this._parseTag(a)},tags:function(){return this._get("_tags")},_tags:function(){this._parseAllTags();var a=["seq","seq_reverse_complemented","unmapped"];this._get("unmapped")||a.push("start","end","strand","score","qual","MQ","CIGAR","length_on_ref");this._get("multi_segment_template")&&a.push("multi_segment_all_aligned","multi_segment_next_segment_unmapped","multi_segment_next_segment_reversed","multi_segment_first",
"multi_segment_last","secondary_alignment","qc_failed","duplicate","next_segment_position");var a=a.concat(this._tagList||[]),d=this.data,c;for(c in d)d.hasOwnProperty(c)&&"_"!=c[0]&&a.push(c);var b={};return a=m.filter(a,function(a){if(a in this.data&&void 0===this.data[a])return!1;var a=a.toLowerCase(),c=b[a];b[a]=!0;return!c},this)},parent:function(){},children:function(){return this._get("subfeatures")},id:function(){return this._get("name")+"/"+this._get("md")+"/"+this._get("cigar")+"/"+this._get("start")},
mq:function(){var a=(this._get("_bin_mq_nl")&65280)>>8;return 255==a?void 0:a},score:function(){return this._get("mq")},qual:function(){if(!this._get("unmapped")){for(var a=[],d=this.bytes.byteArray,c=this.bytes.start+36+this._get("_l_read_name")+4*this._get("_n_cigar_op")+this._get("_seq_bytes"),b=this._get("seq_length"),e=0;e<b;++e)a.push(d[c+e]);return a.join(" ")}},strand:function(){var a=this._get("xs");return a?"-"==a?-1:1:this._get("seq_reverse_complemented")?-1:1},_l_read_name:function(){return this._get("_bin_mq_nl")&
255},_seq_bytes:function(){return this._get("seq_length")+1>>1},seq:function(){for(var a="",d=this.bytes.byteArray,c=this.bytes.start+36+this._get("_l_read_name")+4*this._get("_n_cigar_op"),b=this._get("_seq_bytes"),e=0;e<b;++e)var g=d[c+e],a=a+h[(g&240)>>4],a=a+h[g&15];return a},name:function(){return this._get("_read_name")},_read_name:function(){for(var a=this.bytes.byteArray,d="",c=this._get("_l_read_name"),b=this.bytes.start+36,e=0;e<c-1;++e)d+=String.fromCharCode(a[b+e]);return d},_n_cigar_op:function(){return this._get("_flag_nc")&
65535},cigar:function(){if(!this._get("unmapped")){for(var a=this.bytes.byteArray,g=this._get("_n_cigar_op"),c=this.bytes.start+36+this._get("_l_read_name"),b="",h=0,i=0;i<g;++i){var f=e(a,c),l=f>>4,f=d[f&15],b=b+(l+f);"H"!=f&&"S"!=f&&"I"!=f&&(h+=l);c+=4}this.data.length_on_ref=h;return b}},next_segment_position:function(){var a=this.file.indexToChr[this._get("_next_refid")];if(a)return a.name+":"+this._get("_next_pos")},subfeatures:function(){if(this.store.createSubfeatures){var a=this._get("cigar");
if(a)return this._cigarToSubfeats(a)}},length_on_ref:function(){this._get("cigar");return this.data.length_on_ref},_flags:function(){return(this.get("_flag_nc")&4294901760)>>16},end:function(){return this._get("start")+(this._get("length_on_ref")||this._get("seq_length")||void 0)},seq_id:function(){return this._get("unmapped")?void 0:(this.file.indexToChr[this._refID]||{}).name},_bin_mq_nl:function(){with(this.bytes)return e(byteArray,start+12)},_flag_nc:function(){with(this.bytes)return e(byteArray,
start+16)},seq_length:function(){with(this.bytes)return e(byteArray,start+20)},_next_refid:function(){with(this.bytes)return e(byteArray,start+24)},_next_pos:function(){with(this.bytes)return e(byteArray,start+28)},template_length:function(){with(this.bytes)return e(byteArray,start+32)},_coreParse:function(){with(this.bytes)this._refID=e(byteArray,start+4),this.data.start=e(byteArray,start+8)},_parseTag:function(a){if(!this._allTagsParsed){this._tagList=this._tagList||[];for(var d=this.bytes.byteArray,
c=this._tagOffset||this.bytes.start+36+this._get("_l_read_name")+4*this._get("_n_cigar_op")+this._get("_seq_bytes")+this._get("seq_length"),b=this.bytes.end;c<b&&h!=a;){var g=String.fromCharCode(d[c],d[c+1]),h=g.toLowerCase(),f=String.fromCharCode(d[c+2]),c=c+3;switch(f.toLowerCase()){case "a":f=String.fromCharCode(d[c]);c+=1;break;case "i":f=e(d,c);c+=4;break;case "c":f=d[c];c+=1;break;case "s":f=i(d,c);c+=2;break;case "f":f=l(d,c);c+=4;break;case "z":case "h":for(f="";c<=b;){var m=d[c++];if(0==
m)break;else f+=String.fromCharCode(m)}break;default:console.warn("Unknown BAM tag type '"+f+"', tags may be incomplete"),f=void 0,c=b}this._tagOffset=c;this._tagList.push(g);if(h==a)return f;this.data[h]=f}this._allTagsParsed=!0}},_parseAllTags:function(){this._parseTag()},_flagMasks:{multi_segment_template:1,multi_segment_all_aligned:2,unmapped:4,multi_segment_next_segment_unmapped:8,seq_reverse_complemented:16,multi_segment_next_segment_reversed:32,multi_segment_first:64,multi_segment_last:128,
secondary_alignment:256,qc_failed:512,duplicate:1024},_parseFlag:function(a){return!!(this._get("_flags")&this._flagMasks[a])},_parseCigar:function(a){return m.map(a.match(/\d+\D/g),function(a){return[a.match(/\D/)[0].toUpperCase(),parseInt(a)]})},_cigarToSubfeats:function(a){for(var d=[],c=this._get("start"),b,a=this._parseCigar(a),e=0;e<a.length;e++){var h=a[e][1],f=a[e][0];"="===f&&(f="E");switch(f){case "M":case "D":case "N":case "E":case "X":b=c+h;break;case "I":b=c}"N"!==f&&(c=new g({data:{type:f,
start:c,end:b,strand:this._get("strand"),cigar_op:h+f},parent:this}),d.push(c));c=b}return d}})})},"JBrowse/Model/SimpleFeature":function(){define(["JBrowse/Util"],function(m){var q=0,o=m.fastDeclare({constructor:function(g){g=g||{};this.data=g.data||{};this._parent=g.parent;this._uniqueID=g.id||this.data.uniqueID||(this._parent?this._parent.id()+"_"+q++:"SimpleFeature_"+q++);if(g=this.data.subfeatures)for(var h=0;h<g.length;h++)"function"!=typeof g[h].get&&(g[h]=new o({data:g[h],parent:this}))},
get:function(g){return this.data[g]},set:function(g,h){this.data[g]=h},tags:function(){var g=[],h=this.data,d;for(d in h)h.hasOwnProperty(d)&&g.push(d);return g},id:function(g){if(g)this._uniqueID=g;return this._uniqueID},parent:function(){return this._parent},children:function(){return this.get("subfeatures")}});return o})}}});
define("JBrowse/Store/SeqFeature/BAM","dojo/_base/declare,dojo/_base/array,dojo/_base/Deferred,dojo/_base/lang,JBrowse/has,JBrowse/Util,JBrowse/Store/SeqFeature,JBrowse/Store/DeferredStatsMixin,JBrowse/Store/DeferredFeaturesMixin,JBrowse/Model/XHRBlob,JBrowse/Store/SeqFeature/GlobalStatsEstimationMixin,./BAM/File".split(","),function(m,q,o,g,h,d,e,i,l,a,k,c){return m([e,i,l,k],{constructor:function(b){this.createSubfeatures=b.subfeatures;var d=b.bam||new a(this.resolveUrl(b.urlTemplate||"data.bam")),
e=b.bai||new a(this.resolveUrl(b.baiUrlTemplate||(b.urlTemplate?b.urlTemplate+".bai":"data.bam.bai")));this.bam=new c({store:this,data:d,bai:e,chunkSizeLimit:b.chunkSizeLimit});this.source=(d.url?d.url.match(/\/([^/\#\?]+)($|[\#\?])/)[1]:d.blob?d.blob.name:void 0)||void 0;h("typed-arrays")?this.bam.init({success:dojo.hitch(this,"_estimateGlobalStats",dojo.hitch(this,function(a,b){b?this._failAllDeferred(b):(this.globalStats=a,this._deferred.stats.resolve({success:!0}),this._deferred.features.resolve({success:!0}))}),
dojo.hitch(this,"_failAllDeferred")),failure:dojo.hitch(this,"_failAllDeferred")}):this._failAllDeferred("Web browser does not support typed arrays")},hasRefSeq:function(a,c,d){var e=this,a=e.browser.regularizeReferenceName(a);this._deferred.stats.then(function(){c(a in e.bam.chrToIndex)},d)},_getFeatures:function(a,c,d,e){this.bam.fetch(this.refSeq.name,a.start,a.end,c,d,e)}})});