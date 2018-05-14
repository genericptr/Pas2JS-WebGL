{$mode objfpc}

unit Mat4;
interface
uses
	BrowserConsole, JS, Math;

type
	TScalar = single;
	TScalarArray = array of TScalar;

type
	TMat4 = class
		public
			constructor Identity;
			constructor Translate(const tx,ty,tz: TScalar);
			constructor RotateZ(const Angle:TScalar);
			constructor RotateY(const Angle:TScalar);
			constructor RotateX(const Angle:TScalar);
			constructor Scale (const x, y, z: TScalar);

			constructor Ortho(const Left,Right,Bottom,Top,zNear,zFar:TScalar);
			constructor Perspective(const fovy,Aspect,zNear,zFar:TScalar);

			function Multiply (m: TMat4): TMat4;
			function CopyList: TScalarArray;

			procedure Show;
		public
			RawComponents:array[0..3, 0..3] of TScalar;
	end;

procedure SinCos (angle: TScalar; var sinus: TScalar, var cosinus: TScalar);

implementation

const
	PI = 3.14159265359;
	DEG2RAD = PI/180.0;
  RAD2DEG = 180.0/PI;
  HalfPI = PI*0.5;	

var
	Matrix4x4Identity: TMat4;

// TODO: this should be in math
procedure SinCos (angle: TScalar; var sinus: TScalar, var cosinus: TScalar); 
begin
	sinus := sin(angle);
	cosinus := cos(angle);
end;

// NOTE: [][] doesn't typecast to array of syntax so we need this
function TMat4.CopyList: TScalarArray; 
var
	x, y: integer;
	list: TJSArray;
begin
	list := TJSArray.new;
	for x := 0 to 3 do
	for y := 0 to 3 do
		list.push(RawComponents[x,y]);
	result := TScalarArray(list);
end;

function TMat4.Multiply (m: TMat4): TMat4;
begin
 result := TMat4.Identity;
 result.RawComponents[0,0]:=(m.RawComponents[0,0]*self.RawComponents[0,0])+(m.RawComponents[0,1]*self.RawComponents[1,0])+(m.RawComponents[0,2]*self.RawComponents[2,0])+(m.RawComponents[0,3]*self.RawComponents[3,0]);
 result.RawComponents[0,1]:=(m.RawComponents[0,0]*self.RawComponents[0,1])+(m.RawComponents[0,1]*self.RawComponents[1,1])+(m.RawComponents[0,2]*self.RawComponents[2,1])+(m.RawComponents[0,3]*self.RawComponents[3,1]);
 result.RawComponents[0,2]:=(m.RawComponents[0,0]*self.RawComponents[0,2])+(m.RawComponents[0,1]*self.RawComponents[1,2])+(m.RawComponents[0,2]*self.RawComponents[2,2])+(m.RawComponents[0,3]*self.RawComponents[3,2]);
 result.RawComponents[0,3]:=(m.RawComponents[0,0]*self.RawComponents[0,3])+(m.RawComponents[0,1]*self.RawComponents[1,3])+(m.RawComponents[0,2]*self.RawComponents[2,3])+(m.RawComponents[0,3]*self.RawComponents[3,3]);
 result.RawComponents[1,0]:=(m.RawComponents[1,0]*self.RawComponents[0,0])+(m.RawComponents[1,1]*self.RawComponents[1,0])+(m.RawComponents[1,2]*self.RawComponents[2,0])+(m.RawComponents[1,3]*self.RawComponents[3,0]);
 result.RawComponents[1,1]:=(m.RawComponents[1,0]*self.RawComponents[0,1])+(m.RawComponents[1,1]*self.RawComponents[1,1])+(m.RawComponents[1,2]*self.RawComponents[2,1])+(m.RawComponents[1,3]*self.RawComponents[3,1]);
 result.RawComponents[1,2]:=(m.RawComponents[1,0]*self.RawComponents[0,2])+(m.RawComponents[1,1]*self.RawComponents[1,2])+(m.RawComponents[1,2]*self.RawComponents[2,2])+(m.RawComponents[1,3]*self.RawComponents[3,2]);
 result.RawComponents[1,3]:=(m.RawComponents[1,0]*self.RawComponents[0,3])+(m.RawComponents[1,1]*self.RawComponents[1,3])+(m.RawComponents[1,2]*self.RawComponents[2,3])+(m.RawComponents[1,3]*self.RawComponents[3,3]);
 result.RawComponents[2,0]:=(m.RawComponents[2,0]*self.RawComponents[0,0])+(m.RawComponents[2,1]*self.RawComponents[1,0])+(m.RawComponents[2,2]*self.RawComponents[2,0])+(m.RawComponents[2,3]*self.RawComponents[3,0]);
 result.RawComponents[2,1]:=(m.RawComponents[2,0]*self.RawComponents[0,1])+(m.RawComponents[2,1]*self.RawComponents[1,1])+(m.RawComponents[2,2]*self.RawComponents[2,1])+(m.RawComponents[2,3]*self.RawComponents[3,1]);
 result.RawComponents[2,2]:=(m.RawComponents[2,0]*self.RawComponents[0,2])+(m.RawComponents[2,1]*self.RawComponents[1,2])+(m.RawComponents[2,2]*self.RawComponents[2,2])+(m.RawComponents[2,3]*self.RawComponents[3,2]);
 result.RawComponents[2,3]:=(m.RawComponents[2,0]*self.RawComponents[0,3])+(m.RawComponents[2,1]*self.RawComponents[1,3])+(m.RawComponents[2,2]*self.RawComponents[2,3])+(m.RawComponents[2,3]*self.RawComponents[3,3]);
 result.RawComponents[3,0]:=(m.RawComponents[3,0]*self.RawComponents[0,0])+(m.RawComponents[3,1]*self.RawComponents[1,0])+(m.RawComponents[3,2]*self.RawComponents[2,0])+(m.RawComponents[3,3]*self.RawComponents[3,0]);
 result.RawComponents[3,1]:=(m.RawComponents[3,0]*self.RawComponents[0,1])+(m.RawComponents[3,1]*self.RawComponents[1,1])+(m.RawComponents[3,2]*self.RawComponents[2,1])+(m.RawComponents[3,3]*self.RawComponents[3,1]);
 result.RawComponents[3,2]:=(m.RawComponents[3,0]*self.RawComponents[0,2])+(m.RawComponents[3,1]*self.RawComponents[1,2])+(m.RawComponents[3,2]*self.RawComponents[2,2])+(m.RawComponents[3,3]*self.RawComponents[3,2]);
 result.RawComponents[3,3]:=(m.RawComponents[3,0]*self.RawComponents[0,3])+(m.RawComponents[3,1]*self.RawComponents[1,3])+(m.RawComponents[3,2]*self.RawComponents[2,3])+(m.RawComponents[3,3]*self.RawComponents[3,3]);
end;

constructor TMat4.Scale (const x, y, z: TScalar);
begin	
	RawComponents[0,0] := x;
	RawComponents[0,1] := 0;
	RawComponents[0,2] := 0;
	RawComponents[0,3] := 0;
        
	RawComponents[1,0] := 0;
	RawComponents[1,1] := y;
	RawComponents[1,2] := 0;
	RawComponents[1,3] := 0;
 
	RawComponents[2,0] := 0;
	RawComponents[2,1] := 0;
	RawComponents[2,2] := z;
	RawComponents[2,3] := 0;
	       
	RawComponents[3,0] := 0;
	RawComponents[3,1] := 0;
	RawComponents[3,2] := 0;
	RawComponents[3,3] := 1;
end;

constructor TMat4.RotateX(const Angle:TScalar);
begin
 RawComponents[0,0]:=1.0;
 RawComponents[0,1]:=0.0;
 RawComponents[0,2]:=0.0;
 RawComponents[0,3]:=0.0;
 RawComponents[1,0]:=0.0;
 SinCos(Angle,RawComponents[1,2],RawComponents[1,1]);
 RawComponents[1,3]:=0.0;
 RawComponents[2,0]:=0.0;
 RawComponents[2,1]:=-RawComponents[1,2];
 RawComponents[2,2]:=RawComponents[1,1];
 RawComponents[2,3]:=0.0;
 RawComponents[3,0]:=0.0;
 RawComponents[3,1]:=0.0;
 RawComponents[3,2]:=0.0;
 RawComponents[3,3]:=1.0;
end;

constructor TMat4.RotateY(const Angle:TScalar);
begin
 SinCos(Angle,RawComponents[2,0],RawComponents[0,0]);
 RawComponents[0,1]:=0.0;
 RawComponents[0,2]:=-RawComponents[2,0];
 RawComponents[0,3]:=0.0;
 RawComponents[1,0]:=0.0;
 RawComponents[1,1]:=1.0;
 RawComponents[1,2]:=0.0;
 RawComponents[1,3]:=0.0;
 RawComponents[2,1]:=0.0;
 RawComponents[2,2]:=RawComponents[0,0];
 RawComponents[2,3]:=0.0;
 RawComponents[3,0]:=0.0;
 RawComponents[3,1]:=0.0;
 RawComponents[3,2]:=0.0;
 RawComponents[3,3]:=1.0;
end;

constructor TMat4.RotateZ(const Angle:TScalar);
begin
 SinCos(Angle,RawComponents[0,1],RawComponents[0,0]);
 RawComponents[0,2]:=0.0;
 RawComponents[0,3]:=0.0;
 RawComponents[1,0]:=-RawComponents[0,1];
 RawComponents[1,1]:=RawComponents[0,0];
 RawComponents[1,2]:=0.0;
 RawComponents[1,3]:=0.0;
 RawComponents[2,0]:=0.0;
 RawComponents[2,1]:=0.0;
 RawComponents[2,2]:=1.0;
 RawComponents[2,3]:=0.0;
 RawComponents[3,0]:=0.0;
 RawComponents[3,1]:=0.0;
 RawComponents[3,2]:=0.0;
 RawComponents[3,3]:=1.0;
end;

constructor TMat4.Translate(const tx,ty,tz: TScalar);
begin
 RawComponents[0,0]:=1.0;
 RawComponents[0,1]:=0.0;
 RawComponents[0,2]:=0.0;
 RawComponents[0,3]:=0.0;

 RawComponents[1,0]:=0.0;
 RawComponents[1,1]:=1.0;
 RawComponents[1,2]:=0.0;
 RawComponents[1,3]:=0.0;

 RawComponents[2,0]:=0.0;
 RawComponents[2,1]:=0.0;
 RawComponents[2,2]:=1.0;
 RawComponents[2,3]:=0.0;

 RawComponents[3,0]:=tx;
 RawComponents[3,1]:=ty;
 RawComponents[3,2]:=tz;
 RawComponents[3,3]:=1.0;
end;

constructor TMat4.Ortho(const Left,Right,Bottom,Top,zNear,zFar:TScalar);
var
	rml,tmb,fmn:TScalar;
begin
 rml:=Right-Left;
 tmb:=Top-Bottom;
 fmn:=zFar-zNear;
 RawComponents[0,0]:=2.0/rml;
 RawComponents[0,1]:=0.0;
 RawComponents[0,2]:=0.0;
 RawComponents[0,3]:=0.0;
 RawComponents[1,0]:=0.0;
 RawComponents[1,1]:=2.0/tmb;
 RawComponents[1,2]:=0.0;
 RawComponents[1,3]:=0.0;
 RawComponents[2,0]:=0.0;
 RawComponents[2,1]:=0.0;
 RawComponents[2,2]:=(-2.0)/fmn;
 RawComponents[2,3]:=0.0;
 RawComponents[3,0]:=(-(Right+Left))/rml;
 RawComponents[3,1]:=(-(Top+Bottom))/tmb;
 RawComponents[3,2]:=(-(zFar+zNear))/fmn;
 RawComponents[3,3]:=1.0;
end;

constructor TMat4.Perspective(const fovy,Aspect,zNear,zFar:TScalar);
var
	Sine,Cotangent,ZDelta,Radians:TScalar;
begin
 Radians:=(fovy*0.5)*DEG2RAD;
 ZDelta:=zFar-zNear;
 Sine:=sin(Radians);
 if not ((ZDelta=0) or (Sine=0) or (aspect=0)) then begin
  Cotangent:=cos(Radians)/Sine;
  // NOTE: What happens on copy?
  RawComponents:=Matrix4x4Identity.RawComponents;
  RawComponents[0,0]:=Cotangent/aspect;
  RawComponents[1,1]:=Cotangent;
  RawComponents[2,2]:=(-(zFar+zNear))/ZDelta;
  RawComponents[2,3]:=-1-0;
  RawComponents[3,2]:=(-(2.0*zNear*zFar))/ZDelta;
  RawComponents[3,3]:=0.0;
 end;
end;

constructor TMat4.Identity;
begin
	RawComponents[0,0]:=1.0;
	RawComponents[0,1]:=0.0;
	RawComponents[0,2]:=0.0;
	RawComponents[0,3]:=0.0;

	RawComponents[1,0]:=0.0;
	RawComponents[1,1]:=1.0;
	RawComponents[1,2]:=0.0;
	RawComponents[1,3]:=0.0;

	RawComponents[2,0]:=0.0;
	RawComponents[2,1]:=0.0;
	RawComponents[2,2]:=1.0;
	RawComponents[2,3]:=0.0;

	RawComponents[3,0]:=0.0;
	RawComponents[3,1]:=0.0;
	RawComponents[3,2]:=0.0;
	RawComponents[3,3]:=1.0;
end;

procedure TMat4.Show;
var
	x, y: integer;
begin
	for y := 0 to 3 do
		begin
			write('[');
			for x := 0 to 3 do
				begin
					if x < 3 then
						write(RawComponents[x, y], ',')
					else
						write(RawComponents[x, y]);
				end;
			write(']');
		end;
end;

begin
	Matrix4x4Identity := TMat4.Identity;
end.