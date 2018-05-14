{$mode objfpc}

unit MemoryBuffer;
interface
uses
	JS;

type
	TMemoryBuffer = class
		private
			byteBuffer: TJSUint8Array;
		public
		 constructor Create (size: integer);
		 procedure AddBytes (count: integer; data: array of byte);
		 procedure AddFloats (count: integer; data: array of single);
		 property GetBytes: TJSUint8Array read byteBuffer;
		private
			byteOffset: integer;
			floatBuffer: TJSFloat32Array;
	end;

implementation

constructor TMemoryBuffer.Create (size: integer);
begin
	byteBuffer := TJSUint8Array.New(size);
end;

procedure TMemoryBuffer.AddBytes (count: integer; data: array of byte);
begin
	//writeln('AddBytes: @', byteOffset, ' -> ', data);
	byteBuffer._set(data, byteOffset);
	byteOffset := byteOffset + (count * 1);
end;

procedure TMemoryBuffer.AddFloats (count: integer; data: array of single);
var
	floatOffset: integer;
begin
	floatOffset := byteOffset div 4;
	//writeln('AddFloats: @', byteOffset, '/', floatOffset, ' -> ', data);

	if floatBuffer = nil then
		floatBuffer := TJSFloat32Array.New(byteBuffer.buffer, 0, byteBuffer.byteLength div 4);

	floatBuffer._set(data, floatOffset);

	byteOffset := byteOffset + (count * 4);
end;

end.