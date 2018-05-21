unit GLTypes;
interface
uses
	WebGL, JS;

// TODO: when advanced record syntax is added move these to records

type
	TVec2 = array of GLfloat;
	TVec3 = array of GLfloat;
	TRGBAb = array of GLubyte;
	TRGBAf = array of GLfloat;

function V2(x, y: GLfloat): TVec2;
function V3(x, y, z: GLfloat): TVec3;

function RGBAb(r, g, b, a: GLubyte): TRGBAb;
function RGBAf(r, g, b, a: GLfloat): TRGBAf;

implementation

function V2(x, y: GLfloat): TVec2;
begin
	result[0] := x;
	result[1] := y;
end;

function V3(x, y, z: GLfloat): TVec2;
begin
	result[0] := x;
	result[1] := y;
	result[2] := z;
end;

function RGBAb(r, g, b, a: GLubyte): TRGBAb;
begin
	result[0] := r;
	result[1] := g;
	result[2] := b;
	result[3] := a;
end;

function RGBAf(r, g, b, a: GLfloat): TRGBAf;
begin
	result[0] := r;
	result[1] := g;
	result[2] := b;
	result[3] := a;
end;

end.